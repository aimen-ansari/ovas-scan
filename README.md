# OvaScan · Ultrasound Research Studio

A redesigned TanStack Start / React website with a notebook-aligned PyTorch + FastAPI inference service.

## What is complete, and what is still needed

Implemented: responsive workspace, image validation/preview, model health and connection setup, real inference API, exact notebook preprocessing and class mapping, Grad-CAM, class scores, downloadable HTML/JSON reports, optional authenticated cloud saving, private scan history, search/filter/delete, research comparisons, and enquiry drafts.

**The uploaded notebook does not contain the trained model weights.** It saves them separately in Google Drive. No `.pth`, `.pt`, `.onnx`, or `.h5` file was supplied. Real inference stays disabled until `efficientnet_b3_best.pth` is present and the model service is running. The website never invents predictions.

The hosted web preview does not run Python. Connect it to a separately hosted Python API after adding the weights. The downloadable project can run both parts locally. Cloud sign-in and storage use the original supplied Supabase project; its availability could not be verified from the build environment. No remote database changes were applied.

## Fastest local start on Windows

1. Install **Node.js 22+** and **Python 3.12**; enable “Add Python to PATH”.
2. Extract the entire ZIP. Do not run the files from inside the ZIP viewer.
3. Get the original trained checkpoint from:
   `Google Drive / MyDrive / Ovarian_Research_Project / models / efficientnet_b3_best.pth`.
4. Put that file in `backend/models/efficientnet_b3_best.pth`.
5. Double-click **START-WINDOWS.bat**. It installs dependencies and opens two terminal windows. The first setup downloads the CPU PyTorch runtime.
6. When the website is ready, open **http://localhost:5173**. Keep both terminal windows open.
7. The model indicator should say **Model connected**. If you previously saved a model URL in the browser, open Model connection and enter `http://127.0.0.1:8000`.
8. Upload a de-identified JPG, PNG, or WebP image and choose **Analyze ultrasound**.

You do not need to retrain the model if the notebook already saved the checkpoint. `scripts/export_model_from_colab.py` contains a short Colab cell that downloads the existing file. It does not train anything.

On macOS/Linux with Python 3.12: run `bash start-local.sh`. Both scripts are for local development. The dependency pins target the tested Linux/Windows CPU build; for Apple Silicon install compatible native torch/torchvision wheels and remove the `+cpu` suffixes if those CPU wheel names are unavailable for your platform.

## Manual start

```bash
npx --yes --package=bun bun install --frozen-lockfile
python -m venv .venv
```

Activate the environment (`.venv\Scripts\activate` on Windows or `source .venv/bin/activate` on Linux). Then:

```bash
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

In a second terminal set the following frontend values in `.env`, preserving the supplied Supabase values:

```dotenv
VITE_MODEL_API_URL=http://127.0.0.1:8000
VITE_TRUSTED_MODEL_ORIGIN=http://127.0.0.1:8000
```

Then run:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

The source ZIP retains the original publishable Supabase configuration in `.env`; `.env` is excluded from Git. No service-role key is included or needed in the browser. Use `.env.example` when configuring a different project.

## Exact model contract

| Setting | Notebook value |
| --- | --- |
| Architecture | torchvision EfficientNet-B3 |
| Classifier | Linear(1536, 5) |
| Output index 0 | complex_cyst |
| Output index 1 | dominant_follicle |
| Output index 2 | healthy |
| Output index 3 | poly_cyst |
| Output index 4 | simple_cyst |
| Image input | RGB, 224 × 224, torchvision Resize |
| Normalization mean | 0.485, 0.456, 0.406 |
| Normalization standard deviation | 0.229, 0.224, 0.225 |
| Prediction | softmax → argmax |
| Grad-CAM layer | features[-1] |
| Attention overlay | jet colormap, alpha 0.45 |
| Training | Adam, learning rate 0.0001, CrossEntropyLoss, batch 32 |

The service recreates the architecture without downloading ImageNet weights, loads the checkpoint with `weights_only=True` and `strict=True`, switches to evaluation mode, and includes the checkpoint SHA-256 in each result. It accepts a raw state_dict or a checkpoint containing `model_state_dict`. A file with matching tensor dimensions is not proof of successful training: use your actual best checkpoint.

The comparison table contains eight architectures. VGG16 has the highest recorded accuracy, but EfficientNet-B3 is integrated because it is used in the notebook's single-image prediction and Grad-CAM sections. The recorded reference example (simple_cyst, 88.77%) is explicitly separated from predictions on new images.

## Python API

- `GET /api/health` — readiness, class order, input size, checksum, auth requirement.
- `POST /api/predict` — multipart `file` plus `include_heatmap=true` or `false`.
- `/docs` — interactive API documentation in development mode.
- Responses return scores in **0–1** units. The UI displays percentages.
- No image is stored by the inference service. Grad-CAM is returned as an inline PNG.
- Missing or incompatible weights produce a visible unavailable status, never random results.
- Requests require JPEG/PNG/WebP, at most 10 MB and 20 megapixels. Animated images and unreadable files are rejected.
- Inference runs one request at a time; overlapping requests can receive 429.

`node scripts/verify-api.mjs http://127.0.0.1:8000` checks a running service. It exits unsuccessfully until the model is ready.

## Host the Python service and connect the web preview

The model requires a Python/CPU host. The Cloudflare web frontend does not execute PyTorch. Use a Python host or container host with persistent model files and enough RAM (start with 2 GB; measure for your workload).

Build the container from the project root:

```bash
docker build -f backend/Dockerfile -t ovascan-api .
```

Copy the trained checkpoint before building, or mount it at `/app/backend/models/efficientnet_b3_best.pth`. Keep weights and datasets out of the frontend public folder.

Set these service environment variables:

```dotenv
ENVIRONMENT=production
REQUIRE_AUTH=true
SUPABASE_URL=<your-project-url>
SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
ALLOWED_ORIGINS=<exact-https-web-origin>
MODEL_DEVICE=cpu
TORCH_NUM_THREADS=2
```

Set these **frontend build-time** values, then rebuild/redeploy:

```dotenv
VITE_MODEL_API_URL=<https-python-service-base-url>
VITE_TRUSTED_MODEL_ORIGIN=<https-python-service-origin>
```

`VITE_TRUSTED_MODEL_ORIGIN` must be the origin only, without a trailing slash or path. Authentication tokens are sent only to that explicitly trusted origin. A URL typed into the connection dialog cannot by itself authorize forwarding a user's token. Do not place API secrets in `VITE_` variables.

Expose the API over HTTPS. Set exact allowed origins, including the private preview origin when testing. Production startup refuses unauthenticated configuration. The included per-process limiter is intended for a single-worker service; a larger deployment should use shared rate limiting. CORS does not replace authentication.

## Supabase sign-in and private history

The web application supports email/password sign-in and sign-up. Sign-up with confirmation enabled tells the user to check their email. Add the website origin and `/auth` callback to the Supabase Auth URL allow list.

For a new database, apply the SQL migrations in `supabase/migrations` in filename order. For the existing project, review and apply only migrations that have not been applied. The original schema and storage policies are preserved. The added migration creates or secures the `ultrasound-scans` bucket, applies upload constraints, and makes the profile ownership check explicit. **It was prepared locally and not applied to your remote project.**

Important behavior:

- Uploading into the workspace creates only a local preview.
- Running analysis sends the image to the configured model service.
- Choosing **Save to account** uploads the scan and stores its prediction under the signed-in user's ID.
- Storage is private. The database stores the object path, not a long-lived signed URL. A fresh five-minute link is created when a saved image is opened.
- If saving the database row fails, the newly uploaded object is removed where possible.
- Legacy rows from the original random-demo predictor are marked as lacking model provenance; no live-model report is generated for them.
- History loads the latest 100 records. The overview's all-time count is separate from statistics over that latest set.

Account availability and authenticated end-to-end storage were not verified because the supplied remote endpoint returned 502 during checks. Restore/configure the Supabase project if your browser also cannot reach it.

## Research provenance and limitations

The original notebook is included, unchanged, at `research/Ovarian_US_Dataset.ipynb`. `research/model_config.json` captures the integration settings. Research figures are extracted from the supplied notebook outputs. Counts in those outputs total **6,876** images: 4,813 training, 1,031 validation, 1,032 test.

Recorded performance is not a new evaluation, external validation, or clinical claim. The split is image-level. File-path overlap checks do not establish patient-level separation or rule out duplicate images. Near-perfect scores need further investigation before drawing clinical conclusions. A softmax score is not a calibrated probability of disease, and Grad-CAM does not establish a lesion boundary. No model accuracy can be verified without the real trained checkpoint and evaluation data.

## Validation performed

- TypeScript type check and production build.
- Five Python integration tests: missing checkpoint rejection, exact preprocessing/order, real EfficientNet-B3 architecture + Grad-CAM contract, malformed image/auth rejection, and HTTP prediction schema.
- Tests use a temporary **untrained** checkpoint only to validate wiring. It is deleted after the test and is never included in the project or served to users. No trained-model accuracy is claimed.
- The internal browser could not reach the preview, so visual desktop/mobile QA and full live account testing were not completed.

To rerun the backend tests:

```bash
python -m pip install pytest
python -m pytest backend/tests -q
```

## Project structure

- `src/` — React/TanStack website, UI, auth, prediction client, research data.
- `backend/` — FastAPI service, exact model/preprocessing, tests, Dockerfile.
- `backend/models/` — place your trained checkpoint here.
- `research/` — original notebook and extracted configuration.
- `public/research/` — recorded notebook figures; no model weights.
- `supabase/migrations/` — account, history, and private upload schema.
- `scripts/export_model_from_colab.py` — download the saved checkpoint from Colab.
- `START-WINDOWS.bat`, `start-local.sh` — local launch helpers.

The contact page downloads an enquiry draft unless `VITE_CONTACT_EMAIL` is configured. It never falsely claims a message was sent.
