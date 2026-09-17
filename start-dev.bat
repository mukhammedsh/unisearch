@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Starting UniSearch Backend and Frontend in separate PowerShell windows...

start "UniSearch Backend" powershell -ExecutionPolicy Bypass -NoExit -Command "npm.cmd run dev:backend"
start "UniSearch Frontend" powershell -ExecutionPolicy Bypass -NoExit -Command "npm.cmd run dev:frontend"
