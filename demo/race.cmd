@echo off
rem The kill shot, in one window: 25 concurrent booking attempts, 1 winner.
rem Run it on camera. It cleans up after itself, so run it as often as you like.
title swellbook race check
cd /d "%~dp0.."
call pnpm race
echo.
pause
