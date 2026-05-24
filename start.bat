@echo off
title YT to MP3 Downloader

echo.
echo  ========================================
echo    YT to MP3 - 320kbps High Quality
echo  ========================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Node.js not found, installing...
    echo.
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    if %errorlevel% neq 0 (
        echo.
        echo  [X] Node.js install failed!
        echo      Please download from https://nodejs.org
        echo.
        pause
        exit /b 1
    )
    echo.
    echo  [OK] Node.js installed. Please close and re-run start.bat
    pause
    exit /b 0
)

echo  [OK] Node.js ready

:: Install npm dependencies
if not exist "%~dp0node_modules" (
    echo  [..] Installing dependencies...
    cd /d "%~dp0"
    call npm install --silent
    if %errorlevel% neq 0 (
        echo  [X] Install failed!
        pause
        exit /b 1
    )
    echo  [OK] Dependencies installed
) else (
    echo  [OK] Dependencies ready
)

echo.
echo  Starting server...
echo  Browser will open automatically.
echo  Press Ctrl+C to stop.
echo.

:: Start server (auto opens browser)
cd /d "%~dp0"
node server.js

pause
