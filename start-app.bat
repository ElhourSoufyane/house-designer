@echo off
title House Designer
if exist "%~dp0dist\House Designer-win32-x64\House Designer.exe" (
    start "" "%~dp0dist\House Designer-win32-x64\House Designer.exe"
) else (
    echo Launching House Designer Desktop...
    cd /d "%~dp0"
    call npm.cmd run start:pc
)
