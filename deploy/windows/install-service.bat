@echo off
REM =====================================================
REM CORE-SERVICES WINDOWS SERVICE INSTALLER
REM Works from any directory - Run as Administrator
REM =====================================================

echo ================================================
echo CORE-SERVICES - WINDOWS SERVICE INSTALLER
echo ================================================

REM Get current directory (where this script is located)
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

REM Navigate to core-services root (two levels up from deploy/windows/)
set "SERVICE_DIR=%SCRIPT_DIR%\..\.."
cd /d "%SERVICE_DIR%"

echo Installing from: %CD%
echo.

echo [1/6] Verifying location...
if not exist "package.json" (
    echo ERROR: package.json not found
    echo This script must be run from deploy/windows/ folder
    echo Current directory: %CD%
    pause
    exit /b 1
)

echo [2/6] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed
    echo Download from: https://nodejs.org
    pause
    exit /b 1
)
node --version

echo [3/6] Building TypeScript project...
npm run build
if errorlevel 1 (
    echo ERROR: Failed to build project
    echo Make sure 'npm run build' works correctly
    pause
    exit /b 1
)

echo [4/6] Installing production dependencies...
npm install --production --silent

echo [5/6] Installing node-windows...
npm install node-windows --silent

echo [6/6] Creating Windows service...
REM Create service using inline Node.js command
node -e "const Service=require('node-windows').Service;const path=require('path');console.log('Creating service...');const svc=new Service({name:'Core Services',description:'Core Services API - Email, PDF, ZPL generation service',script:path.join(__dirname,'dist','app.js'),nodeOptions:['--max-old-space-size=1024'],env:[{name:'NODE_ENV',value:'production'},{name:'CONFIG_MODE',value:'standalone'},{name:'CLIENT_ID',value:'core-dev'},{name:'GPG_PASSPHRASE',value:'CHANGE_THIS_GPG_PASSPHRASE'}],logOnAs:{domain:'workgroup',account:'LocalSystem',password:''}});svc.on('install',()=>{console.log('✅ Service installed successfully');console.log('🚀 Starting service...');setTimeout(()=>svc.start(),2000);});svc.on('start',()=>{console.log('🟢 Service started successfully');console.log('🌐 API available at: http://localhost:3001');console.log('📊 View logs in: Event Viewer > Application');console.log('');console.log('================================================');console.log('INSTALLATION COMPLETED');console.log('================================================');});svc.on('error',err=>{console.error('❌ Error:',err.message);});if(!require('fs').existsSync(path.join(__dirname,'dist','app.js'))){console.error('❌ ERROR: dist/app.js not found');console.error('   Run: npm run build');process.exit(1);}svc.install();"

echo.
echo ================================================
echo SERVICE INSTALLATION COMPLETED
echo ================================================
echo Location: %CD%
echo.
echo ⚠️ IMPORTANT: Update GPG_PASSPHRASE
echo   1. Open services.msc
echo   2. Find "Core Services" → Properties
echo   3. Log On tab → Environment variables
echo   4. Change GPG_PASSPHRASE value
echo.
echo To check service status:
echo   services.msc → "Core Services"
echo.
echo To view logs:
echo   Event Viewer → Application → Filter by "Core Services"
echo.
echo To manage the service use:
echo   start-service.bat
echo   stop-service.bat
echo   restart-service.bat
echo   status-service.bat
echo.
echo To test API:
echo   http://localhost:3001/health
echo.
pause