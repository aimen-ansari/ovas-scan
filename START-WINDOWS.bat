@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo Install Node.js 22 or newer first. & pause & exit /b 1)
where python >nul 2>nul
if errorlevel 1 (echo Install Python 3.12 first. & pause & exit /b 1)
if not exist .venv\Scripts\python.exe python -m venv .venv
if not exist .venv\Scripts\python.exe (echo Could not create Python environment. & pause & exit /b 1)
call .venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if errorlevel 1 (echo Python dependency installation failed. & pause & exit /b 1)
call npx --yes --package=bun bun install --frozen-lockfile
if errorlevel 1 (echo Web dependency installation failed. & pause & exit /b 1)
if not exist backend\models\efficientnet_b3_best.pth echo NOTE: Add efficientnet_b3_best.pth to backend\models for real predictions.
set VITE_MODEL_API_URL=http://127.0.0.1:8000
set VITE_TRUSTED_MODEL_ORIGIN=http://127.0.0.1:8000
start "OvaScan model service" cmd /k ".venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000"
start "OvaScan website" cmd /k "npm run dev -- --host 127.0.0.1 --port 5173"
echo Open http://localhost:5173 in your browser when the website is ready.
pause
