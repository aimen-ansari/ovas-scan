"""Contract tests. A disposable, untrained fixture checks wiring, NEVER accuracy."""
import base64
import io
from pathlib import Path
import pytest
import torch
from fastapi.testclient import TestClient
from PIL import Image
from torchvision import models
from backend import app as api
from backend.model import ModelService, CLASSES, PREPROCESS, decode_image

@pytest.fixture(scope="module")
def disposable_model(tmp_path_factory):
    directory = tmp_path_factory.mktemp("UNTRAINED_TEST_FIXTURE")
    path = directory / "test_only.pth"
    network = models.efficientnet_b3(weights=None)
    network.classifier[1] = torch.nn.Linear(network.classifier[1].in_features, 5)
    torch.save(network.state_dict(), path)
    service = ModelService(path)
    service.load()
    yield service
    path.unlink()

@pytest.fixture
def image_bytes():
    stream=io.BytesIO();Image.new("RGB",(80,110),(80,110,140)).save(stream,format="PNG")
    return stream.getvalue()

def test_missing_checkpoint_never_returns_prediction(tmp_path,image_bytes,monkeypatch):
    service=ModelService(tmp_path/"missing.pth")
    monkeypatch.setattr(api,"model_service",service)
    with TestClient(api.app) as client:
        assert client.get("/api/health").json()["status"] == "missing_weights"
        response=client.post("/api/predict",files={"file":("scan.png",image_bytes,"image/png")})
        assert response.status_code==503
        assert "probabilities" not in response.json()

def test_exact_preprocessing_and_output_order(image_bytes):
    tensor=PREPROCESS(decode_image(image_bytes))
    assert tuple(tensor.shape)==(3,224,224)
    assert tensor[0,0,0].item()==pytest.approx((80/255-.485)/.229,abs=1e-6)
    assert CLASSES==["complex_cyst","dominant_follicle","healthy","poly_cyst","simple_cyst"]

def test_real_architecture_contract_and_gradcam(disposable_model,image_bytes):
    assert disposable_model.status=="ready"
    plain=disposable_model.predict(decode_image(image_bytes),False)
    attention=disposable_model.predict(decode_image(image_bytes),True)
    assert abs(sum(plain["probabilities"].values())-1)<1e-5
    assert plain["confidence"]==max(plain["probabilities"].values())
    assert attention["probabilities"]==pytest.approx(plain["probabilities"],abs=1e-5)
    assert len(plain["weights_sha256"])==64
    overlay=Image.open(io.BytesIO(base64.b64decode(attention["heatmap_url"].split(",")[1])))
    assert overlay.size==(224,224)
    assert len(disposable_model.network.features[-1]._forward_hooks)==0

def test_invalid_image_and_auth_contract(disposable_model,image_bytes,monkeypatch):
    monkeypatch.setattr(api,"model_service",disposable_model)
    with TestClient(api.app) as client:
        assert client.post("/api/predict",files={"file":("fake.png",b"not an image","image/png")}).status_code==422
        assert client.post("/api/predict",files={"file":("file.pdf",b"%PDF","application/pdf")}).status_code==415
        monkeypatch.setattr(api,"REQUIRE_AUTH",True)
        assert client.post("/api/predict",files={"file":("scan.png",image_bytes,"image/png")}).status_code==401

def test_http_prediction_contract(disposable_model,image_bytes,monkeypatch):
    monkeypatch.setattr(api,"model_service",disposable_model)
    monkeypatch.setattr(api,"REQUIRE_AUTH",False)
    with TestClient(api.app) as client:
        response=client.post("/api/predict",files={"file":("scan.png",image_bytes,"image/png")},data={"include_heatmap":"false"})
        assert response.status_code==200
        assert response.json()["heatmap_url"] is None
        assert response.json()["model"]=="efficientnet_b3"
