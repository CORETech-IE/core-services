REM stop-service.bat  
@echo off
echo Stopping Core Services...
net stop "Core Services"
if errorlevel 1 (
    echo ERROR: Service could not be stopped
    echo Service may be already stopped or does not exist.
    echo If you want to uninstall the service, run:
    echo uninstall-service.bat
    echo If you want to start the service again, run:
    echo start-service.bat
    echo You can also check the service status using:
    echo sc query "Core Services"    
) else (
    echo ✅ Service stopped successfully.
    echo You can now safely uninstall the service if needed.
    echo If you want to uninstall the service, run:
    echo uninstall-service.bat
    echo If you want to start the service again, run:
    echo start-service.bat
)
pause