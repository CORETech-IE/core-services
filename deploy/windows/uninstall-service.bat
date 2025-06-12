@echo off
REM =====================================================
REM CORE-SERVICES WINDOWS SERVICE UNINSTALLER
REM Run as Administrator from deploy/windows/ folder
REM =====================================================

echo ================================================
echo ⚠️ UNINSTALLING CORE SERVICES
echo ================================================

REM Get current directory and navigate to core-services root
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%\..\.."

echo Current directory: %CD%
echo.

REM Verify we're in the correct location
if not exist "package.json" (
    echo ERROR: package.json not found
    echo This script must be run from deploy/windows/ folder
    echo Current directory: %CD%
    pause
    exit /b 1
)

echo Found core-services project at: %CD%
echo.

set /p confirm="Are you sure you want to uninstall the Core Services Windows Service? (Y/N): "
if /i not "%confirm%"=="Y" (
    echo Operation cancelled
    pause
    exit /b
)

echo.
echo [1/3] Stopping service...
net stop "Core Services" >nul 2>&1
if errorlevel 1 (
    echo Service was already stopped or not found
) else (
    echo Service stopped successfully
)

echo [2/3] Checking node-windows dependency...
npm list node-windows >nul 2>&1
if errorlevel 1 (
    echo Installing node-windows...
    npm install node-windows --silent
    if errorlevel 1 (
        echo ERROR: Failed to install node-windows
        echo Make sure npm is working correctly
        pause
        exit /b 1
    )
) else (
    echo node-windows is available
)

echo [3/3] Uninstalling Windows service...
REM Uninstall service using inline Node.js command (no separate .js files needed)
node -e "const Service=require('node-windows').Service;const path=require('path');console.log('🗑️ Uninstalling Core Services...');const svc=new Service({name:'Core Services',script:path.join(__dirname,'dist','app.js')});svc.on('uninstall',()=>{console.log('✅ Service uninstalled successfully');console.log('🧹 Windows Service cleanup completed');console.log('');console.log('================================================');console.log('UNINSTALLATION COMPLETED');console.log('================================================');console.log('');console.log('The Core Services Windows Service has been removed');console.log('from the system. You can manually delete this folder');console.log('if you no longer need the application.');console.log('');});svc.on('error',err=>{console.error('❌ Uninstall error:',err.message);console.error('You may need to remove the service manually using:');console.error('sc delete \"Core Services\"');});svc.uninstall();"

if errorlevel 1 (
    echo.
    echo ⚠️ Uninstall script encountered an error
    echo You may need to remove the service manually:
    echo   sc delete "Core Services"
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ Uninstallation process completed successfully
echo.
echo The "Core Services" Windows Service has been removed.
echo Event Viewer logs may still contain historical entries.
echo.
echo To completely remove the application:
echo   1. Delete this entire folder
echo   2. Remove any shortcuts or references
echo.
pause