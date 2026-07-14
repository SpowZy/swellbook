@echo off
rem Stops the Swellbook server (the database container keeps running).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" -StopOnly %*
