@echo off
rem Full reset between demo takes: wipes the local database, reseeds the 13
rem listings with zero bookings, restarts the server, reopens the browser.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" -Reset %*
