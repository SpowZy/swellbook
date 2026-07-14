@echo off
rem Boots the Swellbook demo: Docker + Postgres + seeded data + production
rem server, then opens the browser. Safe to run twice: it just reattaches.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
