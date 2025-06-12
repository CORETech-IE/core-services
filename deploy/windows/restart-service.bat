REM =====================================================
REM start-service.bat
REM =====================================================
@echo off
echo Starting Core Services...
net start "Core Services"
if errorlevel 1 (
    echo ERROR: Could not start service
    echo Check services.msc for details
) else (
    echo ✅ Service started successfully
    echo 🌐 API available at: http://localhost:3001/health
    timeout /t 3 /nobreak >nul
    echo 🔍 Testing API...
    curl -s http://localhost:3001/health >nul 2>&1
    if errorlevel 1 (
        echo ⚠️ API not responding yet, give it a few more seconds
    ) else (
        echo ✅ API working correctly
    )
)
pause

REM =====================================================
REM stop-service.bat
REM =====================================================
@echo off
echo Stopping Core Services...
net stop "Core Services"
if errorlevel 1 (
    echo ERROR: Could not stop service
    echo Service might already be stopped
) else (
    echo ✅ Service stopped successfully
)
pause

REM =====================================================
REM restart-service.bat
REM =====================================================
@echo off
echo ================================================
echo RESTARTING CORE SERVICES
echo ================================================
echo.

echo [1/3] Stopping service...
net stop "Core Services" >nul 2>&1

echo [2/3] Waiting 5 seconds...
timeout /t 5 /nobreak >nul

echo [3/3] Starting service...
net start "Core Services"
if errorlevel 1 (
    echo ERROR: Could not restart service
    echo Check services.msc or Event Viewer for details
    pause
    exit /b 1
)

echo ✅ Service restarted successfully
echo.
echo 🔍 Verifying API response...
timeout /t 10 /nobreak >nul

curl -s http://localhost:3001/health >nul 2>&1
if errorlevel 1 (
    echo ⚠️ Service started but API not responding
    echo Check Event Viewer for error details
    echo Service might need more time to initialize
) else (
    echo ✅ API working correctly
    echo 🌐 http://localhost:3001/health
)
echo.
pause

REM =====================================================
REM status-service.bat
REM =====================================================
@echo off
echo ================================================
echo CORE SERVICES STATUS
echo ================================================
echo Current directory: %CD%
echo.

REM Check if service exists
sc query "Core Services" >nul 2>&1
if errorlevel 1 (
    echo ❌ Service not installed
    echo Run install-service.bat first
    goto :end
)

REM Show service status
echo 🔍 Service status:
sc query "Core Services" | find "STATE"

REM Test API
echo.
echo 🔍 Testing API...
curl -s -w "Response time: %%{time_total}s\n" http://localhost:3001/health 2>nul
if errorlevel 1 (
    echo ❌ API not responding
    echo.
    echo Possible causes:
    echo - Service is stopped
    echo - Service is starting up
    echo - Configuration error
    echo.
    echo Check Event Viewer for more details
) else (
    echo ✅ API working correctly
)

:end
echo.
echo For detailed logs:
echo   Event Viewer ^> Application ^> Filter by "Core Services"
echo.
echo For service management:
echo   services.msc ^> "Core Services"
echo.
pause

REM =====================================================
REM uninstall-service.bat
REM =====================================================
@echo off
echo ================================================
echo ⚠️ UNINSTALLING CORE SERVICES
echo ================================================
echo Current directory: %CD%
echo.

REM Verify we're in the correct location
cd /d "%~dp0\..\.."
if not exist "package.json" (
    echo ERROR: Run from deploy/windows/ folder
    echo package.json not found in: %CD%
    pause
    exit /b 1
)

set /p confirm="Are you sure you want to uninstall the service? (Y/N): "
if /i not "%confirm%"=="Y" (
    echo Operation cancelled
    pause
    exit /b
)

echo.
echo [1/3] Stopping service...
net stop "Core Services" >nul 2>&1

echo [2/3] Checking node-windows...
npm list node-windows >nul 2>&1
if errorlevel 1 (
    echo Installing node-windows...
    npm install node-windows --silent
)

echo [3/3] Uninstalling service...
REM Uninstall service using inline Node.js command
node -e "const Service=require('node-windows').Service;const path=require('path');console.log('Uninstalling service...');const svc=new Service({name:'Core Services',script:path.join(__dirname,'dist','app.js')});svc.on('uninstall',()=>{console.log('✅ Service uninstalled successfully');console.log('🧹 Cleanup completed');console.log('');console.log('The Core Services service has been removed from the system');console.log('You can manually delete this folder if desired');});svc.on('error',err=>{console.error('❌ Uninstall error:',err.message);});svc.uninstall();"

echo.
echo ✅ Uninstallation process completed
echo.
pause