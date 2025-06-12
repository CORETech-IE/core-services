@echo off
REM =====================================================
REM CORE-SERVICES - CHECK SERVICE STATUS
REM Run from deploy/windows/ folder
REM =====================================================

echo ================================================
echo CORE SERVICES STATUS CHECK
echo ================================================
echo Current directory: %CD%
echo Timestamp: %DATE% %TIME%
echo.

REM Check if service exists
echo 🔍 Checking if service is installed...
sc query "Core Services" >nul 2>&1
if errorlevel 1 (
    echo ❌ Service not installed
    echo.
    echo To install the service:
    echo   run install-service.bat as Administrator
    echo.
    goto :end
)

echo ✅ Service is installed
echo.

REM Show detailed service status
echo 🔍 Service status:
for /f "tokens=4" %%i in ('sc query "Core Services" ^| find "STATE"') do set SERVICE_STATE=%%i
echo    State: %SERVICE_STATE%

sc query "Core Services" | find "STATE"
echo.

REM Test API if service is running
if /i "%SERVICE_STATE%"=="RUNNING" (
    echo 🌐 Testing API connectivity...
    
    REM Test with timeout and response time
    curl -s -w "   Response time: %%{time_total}s" -m 10 http://localhost:3001/health 2>nul
    if errorlevel 1 (
        echo ❌ API not responding
        echo.
        echo Possible issues:
        echo - Service is starting up ^(wait 30-60 seconds^)
        echo - Configuration error
        echo - Port 3001 is blocked
        echo - Application crashed after service start
        echo.
        echo Check Event Viewer for error details
    ) else (
        echo.
        echo ✅ API is working correctly
        echo 🌐 Full API URL: http://localhost:3001/health
    )
) else (
    echo ⚠️ Service is not running - skipping API test
    echo.
    echo To start the service:
    echo   start-service.bat
)

echo.
echo 📊 Additional Information:
echo    Service name: Core Services
echo    Display name: Core Services
echo    Port: 3001
echo    Startup type: Automatic
echo.

:end
echo 📋 Management Commands:
echo    start-service.bat    - Start the service
echo    stop-service.bat     - Stop the service  
echo    restart-service.bat  - Restart the service
echo    status-service.bat   - This status check
echo.
echo 📊 Monitoring:
echo    services.msc                           - Windows Service Manager
echo    Event Viewer ^> Application ^> Core Services - Service logs
echo    http://localhost:3001/health           - API health check
echo.
pause