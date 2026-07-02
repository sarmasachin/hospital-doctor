@echo off
echo ================================
echo   React App Starting...
echo ================================
cd /d C:\Users\DELL\Desktop\hospital-doctor-availability\client
echo Installing dependencies...
call npm install
echo.
echo Starting React on port 3000...
npm start
pause
