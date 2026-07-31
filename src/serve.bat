@echo off
REM ─────────────────────────────────────────────────────────────
REM  serve.bat — one-click local server for FreeCalc
REM  (ES modules will NOT load over file://, so we serve the folder)
REM ─────────────────────────────────────────────────────────────
cd /d "%~dp0"

REM Try Python first (fastest, usually pre-installed)
where python >nul 2>nul
if %errorlevel%==0 (
    echo Starting server at http://localhost:8000/calculator.html
    echo Press Ctrl+C to stop.
    start "" "http://localhost:8000/calculator.html"
    python -m http.server 8000
    exit /b
)

REM Fall back to Node via npx
where node >nul 2>nul
if %errorlevel%==0 (
    echo Starting server at http://localhost:8000/calculator.html
    echo Press Ctrl+C to stop.
    start "" "http://localhost:8000/calculator.html"
    npx --yes serve . -l 8000
    exit /b
)

echo ERROR: Neither Python nor Node was found. Install one of them and retry.
pause
