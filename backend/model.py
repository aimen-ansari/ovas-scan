"""Notebook-aligned EfficientNet-B3 inference; no predictions without a checkpoint."""
from __future__ import annotations
import base64
import hashlib
import io
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import torch
from PIL import Image, UnidentifiedImageError
from torchvision import models, transforms

CLASSES = ["complex_cyst", "dominant_follicle", "healthy", "poly_cyst", "simple_cyst"]
MAX_BYTES = 10 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 20_000_000
PREPROCESS = transforms.Compose([
    transforms.Resize((224, 224)),  # Matches the notebook, not torchvision's 300px default.
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

def decode_image(raw: bytes) -> Image.Image:
    if not raw or len(raw) > MAX_BYTES:
        raise ValueError("Choose an image smaller than 10 MB.")
    try:
        with Image.open(io.BytesIO(raw)) as probe:
            if probe.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError("Only JPEG, PNG, and WebP images are supported.")
            if probe.width * probe.height > 20_000_000:
                raise ValueError("Image dimensions exceed 20 megapixels.")
            if getattr(probe, "n_frames", 1) != 1:
                raise ValueError("Animated images are not supported.")
            probe.verify()
        with Image.open(io.BytesIO(raw)) as image:
            return image.convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValueError("The uploaded file is not a supported, readable image.") from exc

class ModelService:
    def __init__(self, weights: Path, device: str = "cpu"):
        self.weights = weights
        self.device = torch.device(device)
        self.network = None
        self.status = "missing_weights"
        self.message = "Add efficientnet_b3_best.pth to backend/models and restart the service."
        self.sha256 = None
        self.lock = threading.Lock()

    def load(self):
        if not self.weights.is_file():
            return
        try:
            # weights_only prevents arbitrary Python object deserialization.
            state = torch.load(self.weights, map_location="cpu", weights_only=True)
            if isinstance(state, dict) and "model_state_dict" in state:
                state = state["model_state_dict"]
            if not isinstance(state, dict):
                raise ValueError("Expected a state_dict checkpoint")
            network = models.efficientnet_b3(weights=None)
            network.classifier[1] = torch.nn.Linear(network.classifier[1].in_features, len(CLASSES))
            network.load_state_dict(state, strict=True)
            network = network.to(self.device).eval()
            for param in network.parameters():
                param.requires_grad_(False)
            # Fail startup readiness for a checkpoint producing nonfinite output.
            with torch.inference_mode():
                output = network(torch.zeros(1, 3, 224, 224, device=self.device))
                if output.shape != (1, 5) or not torch.isfinite(output).all():
                    raise ValueError("Invalid model output")
            digest = hashlib.sha256()
            with self.weights.open("rb") as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b""):
                    digest.update(block)
            self.sha256 = digest.hexdigest()
            self.network = network
            self.status = "ready"
            self.message = "EfficientNet-B3 checkpoint loaded. Ready for research inference."
        except Exception:
            self.network = None
            self.status = "load_error"
            self.message = "The checkpoint could not be loaded. Use the five-class EfficientNet-B3 state_dict from this notebook."
            import logging
            logging.getLogger(__name__).exception("Model checkpoint load failed")

    def predict(self, image: Image.Image, include_heatmap: bool = True):
        if self.network is None:
            raise RuntimeError(self.message)
        started = time.perf_counter()
        tensor = PREPROCESS(image).unsqueeze(0).to(self.device)
        heatmap_url = None
        # One inference at a time prevents concurrent hooks and CPU memory spikes.
        with self.lock:
            if include_heatmap:
                activations = []
                handle = self.network.features[-1].register_forward_hook(lambda _m, _i, out: activations.append(out))
                try:
                    with torch.enable_grad():
                        tensor.requires_grad_(True)
                        logits = self.network(tensor)
                        index = int(logits.argmax(dim=1).item())
                        gradient = torch.autograd.grad(logits[0, index], activations[0])[0]
                        weights = gradient.mean(dim=(2, 3), keepdim=True)
                        cam = torch.relu((weights * activations[0]).sum(dim=1))[0].detach().cpu().numpy()
                        cam -= cam.min()
                        if cam.max() > 0:
                            cam /= cam.max()
                        heatmap_url = self.overlay(image, cam)
                finally:
                    handle.remove()
            else:
                with torch.inference_mode():
                    logits = self.network(tensor)
                    index = int(logits.argmax(dim=1).item())
            if not torch.isfinite(logits).all():
                raise RuntimeError("The model returned a nonfinite output.")
            probabilities = torch.softmax(logits.detach(), dim=1)[0].cpu().tolist()
        return {
            "predicted_class": CLASSES[index], "confidence": probabilities[index],
            "probabilities": dict(zip(CLASSES, probabilities)), "heatmap_url": heatmap_url,
            "model": "efficientnet_b3", "weights_sha256": self.sha256, "source": "live",
            "elapsed_ms": round((time.perf_counter() - started) * 1000, 1),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def overlay(image, cam):
        from matplotlib import colormaps
        original = np.asarray(image.resize((224, 224)), dtype=np.float32) / 255
        resized = np.asarray(Image.fromarray(np.uint8(cam * 255)).resize((224, 224)), dtype=np.float32) / 255
        # Same jet colormap and alpha=0.45 as notebook cell 100.
        result = np.clip(.55 * original + .45 * colormaps["jet"](resized)[:, :, :3], 0, 1)
        stream = io.BytesIO()
        Image.fromarray(np.uint8(result * 255)).save(stream, format="PNG")
        return "data:image/png;base64," + base64.b64encode(stream.getvalue()).decode("ascii")
