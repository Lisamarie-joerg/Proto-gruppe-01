@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Starte Embodied-Carbon-Web-App...
echo.
echo Im Browser oeffnen:  http://localhost:8501
echo Zum Beenden: dieses Fenster schliessen (Strg+C)
echo.
call .venv\Scripts\activate.bat
python webapp\app.py
pause
