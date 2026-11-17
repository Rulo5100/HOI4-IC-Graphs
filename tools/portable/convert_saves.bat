@echo off
rem Drag a folder of HOI4 saves onto this file to turn them into an IC log in the logs folder.
setlocal
where node >nul 2>nul
if errorlevel 1 goto nonode
if "%~1"=="" goto noarg
if not exist "%~dp0logs" mkdir "%~dp0logs"
node "%~dp0converter\saves_to_log.js" "%~1" --daily --out "%~dp0logs\%~n1_daily.txt"
echo.
echo Open bar_charts.html and load the file from the logs folder.
pause
exit /b 0

:nonode
echo Node.js is needed for this. Get it from https://nodejs.org and run this again.
pause
exit /b 1

:noarg
echo Drag a folder of HOI4 saves onto this file.
pause
exit /b 1
