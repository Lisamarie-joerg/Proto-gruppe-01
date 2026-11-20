@echo off
cd /d "%~dp0"
python "%~dp0website_starten.py"
if errorlevel 1 pause
