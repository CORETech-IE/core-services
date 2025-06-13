@echo off
REM =====================================================
REM CORE-SERVICES - UNIFIED WINDOWS SERVICE MANAGER
REM Run as Administrator for install/uninstall operations
REM =====================================================

echo ================================================
echo CORE SERVICES - WINDOWS SERVICE MANAGER
echo ================================================
echo.

REM Get command from first argument
set COMMAND=%1
set GPG_PASS=%2

REM Show help if no command provided
if "%COMMAND%"=="" goto :show_help

REM Navigate to core-services root
cd /d "%~dp0\..\.."

REM Execute the appropriate command
if /i "%COMMAND%"=="install" goto :install
if /i "%COMMAND%"=="uninstall" goto :uninstall
if /i "%COMMAND%"=="start" goto :start
if /i "%COMMAND%"=="stop" goto :stop
if /i "%COMMAND%"=="restart" goto :restart
if /i "%COMMAND%"=="status" goto :status
if /i "%COMMAND%"=="help" goto :show_help

echo ERROR: Unknown command '%COMMAND%'
echo.
goto :show_help

REM =====================================================
REM INSTALL SERVICE
REM =====================================================
:install
echo [INSTALL] Starting Core Services installation...
echo.

REM Check if GPG passphrase was provided
if "%GPG_PASS%"=="" (
    echo ERROR: GPG passphrase is required for installation
    echo.
    echo Usage: core-services.bat install "your-gpg-passphrase"
    echo.
    echo Example:
    echo   core-services.bat install "my$ecureP@ssphrase123"
    echo.
    goto :end
)

REM Check if service already exists
sc query "Core Services" >nul 2>&1
if not errorlevel 1 (
    echo ERROR: Service already installed
    echo Run 'core-services.bat uninstall' first
    goto :end
)

echo [1/6] Verifying location...
if not exist "package.json" (
    echo ERROR: package.json not found
    echo Run this script from deploy/windows/ folder
    goto :end
)

echo [2/6] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed
    echo Download from: https://nodejs.org
    goto :end
)
node --version

echo [3/6] Building TypeScript project...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed
    goto :end
)

echo [4/6] Installing production dependencies...
call npm install --production --silent

echo [5/6] Installing node-windows...
call npm install node-windows --silent

echo [6/6] Creating Windows service with GPG passphrase...
echo GPG passphrase will be securely stored in the service configuration

REM Create a temporary JS file to handle the complex service creation
echo const Service = require('node-windows').Service; > temp_install.js
echo const path = require('path'); >> temp_install.js
echo. >> temp_install.js
echo const svc = new Service({ >> temp_install.js
echo   name: 'Core Services', >> temp_install.js
echo   description: 'Core Services API - Email, PDF, ZPL generation', >> temp_install.js
echo   script: path.join(__dirname, 'dist', 'scripts', 'start.js'), >> temp_install.js
echo   nodeOptions: ['--max-old-space-size=1024'], >> temp_install.js
echo   env: [ >> temp_install.js
echo     { name: 'NODE_ENV', value: 'production' }, >> temp_install.js
echo     { name: 'CLIENT_ID', value: 'core-dev' }, >> temp_install.js
echo     { name: 'GPG_PASSPHRASE', value: '%GPG_PASS%' }, >> temp_install.js
echo     { name: 'HOST', value: '0.0.0.0' }, >> temp_install.js
echo     { name: 'LOG_LEVEL', value: 'INFO' } >> temp_install.js
echo   ] >> temp_install.js
echo }); >> temp_install.js
echo. >> temp_install.js
echo svc.on('install', () =^> { >> temp_install.js
echo   console.log('✅ Service installed successfully'); >> temp_install.js
echo   console.log('📝 GPG passphrase has been configured'); >> temp_install.js
echo   console.log('🔐 The passphrase is stored securely in Windows service registry'); >> temp_install.js
echo   console.log('🚀 Starting service...'); >> temp_install.js
echo   setTimeout(() =^> svc.start(), 2000); >> temp_install.js
echo }); >> temp_install.js
echo. >> temp_install.js
echo svc.on('start', () =^> { >> temp_install.js
echo   console.log('✅ Service started successfully'); >> temp_install.js
echo   console.log('🌐 API available at: http://localhost:3001'); >> temp_install.js
echo   console.log(''); >> temp_install.js
echo   console.log('================================================'); >> temp_install.js
echo   console.log('INSTALLATION COMPLETED'); >> temp_install.js
echo   console.log('================================================'); >> temp_install.js
echo   console.log(''); >> temp_install.js
echo   console.log('The GPG passphrase has been permanently configured.'); >> temp_install.js
echo   console.log('The service will use it automatically on every restart.'); >> temp_install.js
echo   console.log(''); >> temp_install.js
echo   console.log('To verify installation:'); >> temp_install.js
echo   console.log('  core-services.bat status'); >> temp_install.js
echo   console.log(''); >> temp_install.js
echo   console.log('To change the GPG passphrase later:'); >> temp_install.js
echo   console.log('  1. Uninstall: core-services.bat uninstall'); >> temp_install.js
echo   console.log('  2. Reinstall: core-services.bat install "new-passphrase"'); >> temp_install.js
echo }); >> temp_install.js
echo. >> temp_install.js
echo svc.on('error', err =^> { >> temp_install.js
echo   console.error('❌ Installation error:', err.message); >> temp_install.js
echo }); >> temp_install.js
echo. >> temp_install.js
echo svc.install(); >> temp_install.js

REM Execute the installation
node temp_install.js

REM Clean up temp file
del temp_install.js

goto :end

REM =====================================================
REM UNINSTALL SERVICE
REM =====================================================
:uninstall
echo [UNINSTALL] Removing Core Services...
echo.

set /p confirm="Are you sure? (Y/N): "
if /i not "%confirm%"=="Y" (
    echo Cancelled
    goto :end
)

echo Stopping service...
net stop "Core Services" >nul 2>&1

echo Installing node-windows if needed...
npm install node-windows --silent >nul 2>&1

echo Uninstalling service...
node -e "const Service=require('node-windows').Service;const path=require('path');const svc=new Service({name:'Core Services',script:path.join(__dirname,'dist','scripts','start.js')});svc.on('uninstall',()=>{console.log('✅ Service uninstalled successfully');console.log('🔐 GPG passphrase configuration has been removed')});svc.uninstall();"

echo.
echo ✅ Uninstall completed
echo 🔐 All configuration (including GPG passphrase) has been removed
goto :end

REM =====================================================
REM START SERVICE
REM =====================================================
:start
echo [START] Starting Core Services...
net start "Core Services"
if errorlevel 1 (
    echo ERROR: Could not start service
    echo.
    echo Possible causes:
    echo - Service is not installed (run: core-services.bat install "gpg-passphrase")
    echo - Service is already running
    echo - Check Event Viewer for details
) else (
    echo ✅ Service started
    echo 🔐 Using stored GPG passphrase
    timeout /t 3 /nobreak >nul
    echo.
    echo Testing API...
    curl -s http://localhost:3001/health >nul 2>&1
    if errorlevel 1 (
        echo ⚠️  API not responding yet (give it 30-60 seconds)
    ) else (
        echo ✅ API is working
    )
)
goto :end

REM =====================================================
REM STOP SERVICE
REM =====================================================
:stop
echo [STOP] Stopping Core Services...
net stop "Core Services"
if errorlevel 1 (
    echo ERROR: Could not stop service
    echo Service might not be running or not installed
) else (
    echo ✅ Service stopped
)
goto :end

REM =====================================================
REM RESTART SERVICE
REM =====================================================
:restart
echo [RESTART] Restarting Core Services...
net stop "Core Services" >nul 2>&1
timeout /t 5 /nobreak >nul
net start "Core Services"
if errorlevel 1 (
    echo ERROR: Could not restart service
) else (
    echo ✅ Service restarted
    echo 🔐 Using stored GPG passphrase
    timeout /t 10 /nobreak >nul
    curl -s http://localhost:3001/health >nul 2>&1
    if errorlevel 1 (
        echo ⚠️  API starting up...
    ) else (
        echo ✅ API is working
    )
)
goto :end

REM =====================================================
REM STATUS CHECK
REM =====================================================
:status
echo [STATUS] Checking Core Services...
echo.

REM Check if service exists
sc query "Core Services" >nul 2>&1
if errorlevel 1 (
    echo ❌ Service not installed
    echo.
    echo To install:
    echo   core-services.bat install "your-gpg-passphrase"
    echo.
    goto :end
)

REM Show service status
echo Service Status:
sc query "Core Services" | find "STATE"
echo.

REM Check GPG configuration
echo Configuration:
echo - GPG passphrase: [CONFIGURED - Hidden for security]
echo - Client ID: core-dev
echo - Port: 3001
echo.

REM Test API
echo Testing API...
curl -s -w "Response time: %%{time_total}s\n" http://localhost:3001/health 2>nul
if errorlevel 1 (
    echo ❌ API not responding
    echo.
    echo Troubleshooting:
    echo - Wait 30-60 seconds if service just started
    echo - Check Event Viewer for errors
    echo - Verify GPG passphrase is correct
) else (
    echo ✅ API is working
)
echo.

echo Logs: Event Viewer ^> Application ^> "Core Services"
goto :end

REM =====================================================
REM SHOW HELP
REM =====================================================
:show_help
echo Usage: core-services.bat [command] [options]
echo.
echo Commands:
echo   install "passphrase" - Install service with GPG passphrase
echo   uninstall           - Remove Core Services
echo   start               - Start the service
echo   stop                - Stop the service
echo   restart             - Restart the service
echo   status              - Check service status
echo   help                - Show this help
echo.
echo Examples:
echo   core-services.bat install "my$ecureP@ssphrase123"
echo   core-services.bat status
echo   core-services.bat restart
echo.
echo Notes:
echo   - The GPG passphrase is required only during installation
echo   - It will be stored securely in the Windows service configuration
echo   - The service will use it automatically on every restart
echo   - To change the passphrase, uninstall and reinstall the service
echo.

:end
pause