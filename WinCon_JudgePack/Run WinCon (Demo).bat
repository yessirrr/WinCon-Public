@echo off
cd /d "%~dp0"
if not exist "runtime\node.exe" (
    echo ERROR: Node.js runtime not found in runtime\node.exe
    echo The package appears incomplete. Please re-download.
    pause
    exit /b 1
)
if not exist "app\data\cache\demo" (
    echo ERROR: Demo cache not found.
    pause
    exit /b 1
)
set WINCON_MODE=demo
set WINCON_APP_ROOT=%~dp0app
cls
"runtime\node.exe" "app\dist\index.js"
if errorlevel 1 pause
