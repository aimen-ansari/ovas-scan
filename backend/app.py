"""Run from project root: python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000."""
from __future__ import annotations
import asyncio
import os
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path
import httpx
import torch
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from .model import CLASSES, MAX_BYTES, ModelService, decode_image

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
REQUIRE_AUTH = os.getenv("REQUIRE_AUTH", "true" if ENVIRONMENT == "production" else "false").lower() == "true"
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
ORIGINS = [v.strip() for v in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173").split(",") if v.strip()]
if ENVIRONMENT == "production" and (not REQUIRE_AUTH or not SUPABASE_URL or not SUPABASE_KEY or "*" in ORIGINS):
    raise RuntimeError("Production requires Supabase authentication and explicit allowed origins.")
torch.set_num_threads(max(1, int(os.getenv("TORCH_NUM_THREADS", "2"))))
model_service = ModelService(Path(os.getenv("MODEL_PATH", str(ROOT / "models/efficientnet_b3_best.pth"))), os.getenv("MODEL_DEVICE", "cpu"))

@asynccontextmanager
async def lifespan(app):
    await run_in_threadpool(model_service.load)
    yield

app = FastAPI(title="OvaScan inference API", version="1.0.0", lifespan=lifespan, docs_url="/docs" if ENVIRONMENT != "production" else None, redoc_url=None)
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"])

class BodySizeLimit:
    def __init__(self, app): self.app = app
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "POST":
            return await self.app(scope, receive, send)
        total = 0
        async def limited_receive():
            nonlocal total
            message = await receive()
            total += len(message.get("body", b""))
            if total > MAX_BYTES + 256 * 1024:
                raise HTTPException(413, "Image exceeds the 10 MB limit.")
            return message
        await self.app(scope, limited_receive, send)
app.add_middleware(BodySizeLimit)

requests_by_identity = defaultdict(deque)
request_lock = asyncio.Lock()
inference_gate = asyncio.Semaphore(1)

async def authorize(request: Request):
    if REQUIRE_AUTH:
        authorization = request.headers.get("authorization", "")
        if not authorization.startswith("Bearer "):
            raise HTTPException(401, "Sign in to use this model service.")
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise HTTPException(503, "Authentication is not configured on the model service.")
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(f"{SUPABASE_URL}/auth/v1/user", headers={"apikey": SUPABASE_KEY, "Authorization": authorization})
        except httpx.HTTPError:
            raise HTTPException(503, "The authentication service is temporarily unavailable.")
        if response.status_code != 200:
            raise HTTPException(401, "Your session could not be verified. Please sign in again.")
        identity = response.json().get("id")
        if not identity: raise HTTPException(401, "Invalid account session.")
    else:
        identity = request.client.host if request.client else "local"
    async with request_lock:
        now = time.monotonic()
        for k in list(requests_by_identity):
            if not requests_by_identity[k] or requests_by_identity[k][-1] < now - 60:
                del requests_by_identity[k]
        recent = requests_by_identity[identity]
        while recent and recent[0] < now - 60: recent.popleft()
        if len(recent) >= 12: raise HTTPException(429, "Too many analyses. Wait a minute and try again.")
        recent.append(now)
    return identity

@app.get("/api/health")
def health():
    return {"status": model_service.status, "model": "efficientnet_b3", "message": model_service.message,
            "classes": CLASSES, "input_size": [224, 224], "weights_sha256": model_service.sha256,
            "requires_auth": REQUIRE_AUTH, "research_only": True}

@app.post("/api/predict")
async def predict(file: UploadFile = File(...), include_heatmap: bool = Form(True), _identity: str = Depends(authorize)):
    if model_service.network is None:
        raise HTTPException(503, model_service.message)
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(415, "Use a JPG, PNG, or WebP image.")
    raw = await file.read(MAX_BYTES + 1)
    await file.close()
    if len(raw) > MAX_BYTES: raise HTTPException(413, "Image exceeds the 10 MB limit.")
    try: image = await run_in_threadpool(decode_image, raw)
    except ValueError as exc: raise HTTPException(422, str(exc)) from exc
    try:
        await asyncio.wait_for(inference_gate.acquire(), timeout=.1)
    except TimeoutError:
        raise HTTPException(429, "The model is processing another image. Please try again shortly.")
    try:
        # No image or prediction is saved or logged by the inference service.
        return await run_in_threadpool(model_service.predict, image, include_heatmap)
    except RuntimeError as exc:
        raise HTTPException(503, "Inference failed. Check the model service and try again.") from exc
    finally:
        inference_gate.release()
