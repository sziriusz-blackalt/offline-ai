@echo off
cd /d "%~dp0"
echo Starting Offline AI Studio...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-server.ps1" 8080
pause
