@echo off
cd /d "%~dp0"
echo Im Browser http://localhost:8501/ oeffnen.
echo Server beenden: Strg+C.
python -m http.server 8501 --bind 127.0.0.1 --directory webapp/static
pause
