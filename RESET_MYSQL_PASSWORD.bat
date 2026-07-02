@echo off
title MySQL Root Password Reset
echo ========================================
echo  MySQL Root password reset to: admin123
echo  Run this file as Administrator
echo ========================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Please right-click and "Run as administrator"
    pause
    exit /b 1
)

echo [1/5] Stopping MySQL84...
net stop MySQL84 2>nul
timeout /t 2 /nobreak >nul

echo [2/5] Starting MySQL with password reset file (same config as service)...
start /B "" "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --defaults-file="C:\ProgramData\MySQL\MySQL Server 8.4\my.ini" --init-file=C:\Users\DELL\mysql-init.txt
echo Waiting 20 seconds for MySQL to start and reset password...
timeout /t 20 /nobreak >nul

echo [3/5] Stopping temporary MySQL...
taskkill /IM mysqld.exe /F >nul 2>&1
timeout /t 3 /nobreak >nul

echo [4/5] Starting MySQL84 service...
net start MySQL84
if errorlevel 1 (
    echo Failed to start MySQL84.
    pause
    exit /b 1
)
timeout /t 3 /nobreak >nul

echo [5/5] Testing login...
"C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u root -padmin123 -e "SELECT 1 AS ok;" 2>nul
if errorlevel 1 (
    echo Login test failed. Password may not have reset.
) else (
    echo.
    echo SUCCESS. Root password is now: admin123
    echo Server .env already has this password.
)
echo.
pause
