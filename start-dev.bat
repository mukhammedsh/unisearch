@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Starting UniSearch Backend and Frontend in separate PowerShell windows...

start "UniSearch Backend" powershell -NoExit -Command "npm run dev:backend"
start "UniSearch Frontend" powershell -NoExit -Command "npm run dev:frontend"
