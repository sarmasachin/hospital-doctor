@echo off
echo ================================
echo   Hospital Server Starting...
echo ================================
cd /d C:\Users\DELL\Desktop\hospital-doctor-availability\server
echo Installing dependencies...
call npm install
echo.
echo Starting server on port 5000...
npm start
pause
