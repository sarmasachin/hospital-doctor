@echo off
echo Starting MySQL84 service...
net start MySQL84
if errorlevel 1 (
    echo Failed to start MySQL84. Make sure you ran this as Administrator.
    pause
    exit /b 1
)
echo Waiting for MySQL to be ready...
timeout /t 3 /nobreak >nul
echo Importing database...
cd /d "%~dp0"
"C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u root -padmin123 < server\database.sql
if errorlevel 1 (
    echo Import failed. Check password or run manually.
    pause
    exit /b 1
)
echo Done. Database imported successfully.
del "C:\Users\DELL\mysql-init.txt" 2>nul
pause
