@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

:: Get server URL from parameter or environment
set "SERVER_URL=%~1"
if "%SERVER_URL%"=="" (
    set "SERVER_URL=%DASHADMIN_SERVER_URL%"
)
if "%SERVER_URL%"=="" (
    set "SERVER_URL=https://www.mydashadmin.ru"
)

echo [INFO] Starting DashAdmin Agent...
echo [INFO] Server: %SERVER_URL%
echo.

:: Run in dev mode
start "" "cmd" /k "npm start -- \"%SERVER_URL%\""
