q@echo off
cd /d "%~dp0"
if not exist "runtime\node.exe" (
    echo ERROR: Node.js runtime not found.
    pause
    exit /b 1
)
set WINCON_APP_ROOT=%~dp0app
cls
"runtime\node.exe" "app\dist\index.js"
if errorlevel 1 pause
