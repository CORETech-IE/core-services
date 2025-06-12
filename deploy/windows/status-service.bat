REM status-service.bat  
@echo off
echo ================================================
echo STATUS OF CORE SERVICES
echo ================================================
echo Current Folder: %CD%
echo.

REM Verificar si el servicio existe
sc query "Core Services" >nul 2>&1
if errorlevel 1 (
    echo ❌ Service "Core Services" not installed.
    echo Execute install-service.bat to install it.
    goto :end
)

REM Mostrar estado del servicio
echo 🔍 Service status:
sc query "Core Services" | find "STATE"

REM Probar la API
echo.
echo 🔍 Checking API health...
curl -s -w "Response time: %%{time_total}s\n" http://localhost:3001/health 2>nul
if errorlevel 1 (
    echo ❌ API is not responding.
    echo.
    echo Possible reasons:
    echo - Service is not running
    echo - Service is starting
    echo - Configuration error
    echo - Check Event Viewer for more details
) else (
    echo ✅ API funcionando correctamente
)

:end
echo.
echo To see logs:
echo   Event Viewer ^> Application ^> Filter by "Core Services"
echo.
echo To manage the service:
echo   services.msc ^> "Core Services"
echo.
pause