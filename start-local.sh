#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
npx --yes --package=bun bun install --frozen-lockfile
export VITE_MODEL_API_URL=http://127.0.0.1:8000
export VITE_TRUSTED_MODEL_ORIGIN=http://127.0.0.1:8000
.venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 &
model_pid=$!
trap 'kill "$model_pid" 2>/dev/null || true' EXIT INT TERM
npm run dev -- --host 127.0.0.1 --port 5173
