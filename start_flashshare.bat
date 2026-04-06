@echo off
setlocal enabledelayedexpansion

echo.
echo  =========================================
echo    FLASHSHARE ULTRA - STARTUP ENGINE
echo  =========================================
echo.

:: 1. Force close any existing instances to prevent port conflicts
echo [1/3] Clearing existing ports (3001, 8080)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080') do taskkill /f /pid %%a >nul 2>&1

:: 2. Start Backend
echo [2/3] Launching Ultra Backend...
cd server
start /b node lite-server.js
cd ..

:: 3. Detect and display Network IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set IP=%%a
    set IP=!IP: =!
)

echo [3/3] Launching Ultra Frontend...
echo.
echo  -----------------------------------------
if defined IP (
    echo    SHARE LINK BASE: http://!IP!:8080
    echo    BACKEND API    : http://!IP!:3001
) else (
    echo    SHARE LINK BASE: http://localhost:8080
    echo    BACKEND API    : http://localhost:3001
)
echo  -----------------------------------------
echo.
echo  FILES PERSIST FOR 7 DAYS
echo  SHARE LINKS WORK ON ANY DEVICE IN THE NETWORK
echo  -----------------------------------------
echo.
.\node_modules\.bin\vite --host

pause
