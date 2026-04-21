@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo Checking Node.js...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not installed!
    echo Download from: https://nodejs.org
    pause
    exit /b 1
)

echo [1/3] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm install failed!
    pause
    exit /b 1
)

echo [2/3] Creating icon...
if not exist "icons" mkdir icons

echo [3/3] Building executable...
call npm run build
if %ERRORLEVEL% EQU 0 (
    echo [OK] Build complete!
    echo Executable in: dist\win-unpacked\DashAdmin Agent.exe
) else (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)
