# Core Services - Windows Deployment

This folder contains scripts to install and manage Core Services as a Windows Service.

## Prerequisites

- **Node.js** (LTS version recommended)
- **Administrator privileges** for service installation
- **Compiled project** (`npm run build` must work)

## Installation

1. **Open Command Prompt as Administrator**

2. **Navigate to the deployment folder:**
   ```cmd
   cd E:\path\to\core-services\deploy\windows
   ```

3. **Run the installer:**
   ```cmd
   install-service.bat
   ```

4. **Configure GPG passphrase:**
   - Open `services.msc`
   - Find "Core Services" → Properties
   - Go to "Log On" tab
   - Set environment variables
   - Change `GPG_PASSPHRASE` to your actual GPG passphrase

## Service Management

### Start Service
```cmd
start-service.bat
```

### Stop Service
```cmd
stop-service.bat
```

### Restart Service
```cmd
restart-service.bat
```

### Check Status
```cmd
status-service.bat
```

### Uninstall Service
```cmd
uninstall-service.bat
```

## Verification

### Check Service Status
- Open `services.msc`
- Look for "Core Services"
- Status should be "Running"

### Test API
- Open browser: `http://localhost:3001/health`
- Should return: `OK`

### View Logs
- Open Event Viewer
- Navigate to: Windows Logs → Application
- Filter by source: "Core Services"

## Troubleshooting

### Service Won't Start
1. Check Event Viewer for error messages
2. Verify Node.js is installed: `node --version`
3. Ensure project is built: `npm run build`
4. Check GPG passphrase configuration

### API Not Responding
1. Verify service is running in `services.msc`
2. Check port 3001 is not blocked by firewall
3. Review logs in Event Viewer
4. Wait 30-60 seconds for service to fully initialize

### Configuration Issues
1. Verify `CLIENT_ID` in service environment variables
2. Check `GPG_PASSPHRASE` is correctly set
3. Ensure SOPS and GPG are properly configured
4. Verify `core-envs-private` repository is accessible

## Files Description

| File | Purpose |
|------|---------|
| `install-service.bat` | Install Core Services as Windows Service |
| `uninstall-service.bat` | Remove Core Services Windows Service |
| `start-service.bat` | Start the service |
| `stop-service.bat` | Stop the service |
| `restart-service.bat` | Restart the service |
| `status-service.bat` | Check service and API status |

## Service Configuration

The service is configured with:
- **Name:** Core Services
- **Description:** Core Services API - Email, PDF, ZPL generation service
- **Startup:** Automatic
- **User:** LocalSystem
- **Port:** 3001

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Node.js environment |
| `CONFIG_MODE` | `standalone` | Configuration mode |
| `CLIENT_ID` | `core-dev` | Client identifier |
| `GPG_PASSPHRASE` | ⚠️ **Must be set** | GPG passphrase for SOPS |

## Post-Installation

After successful installation:

1. **Update GPG passphrase** in service configuration
2. **Test API connectivity:** `http://localhost:3001/health`
3. **Verify email functionality:** Use internal API endpoints
4. **Set up monitoring** via Event Viewer or external tools

## Updates and Maintenance

To update Core Services:

1. Stop the service: `stop-service.bat`
2. Update code: `git pull`
3. Rebuild: `npm run build`
4. Restart service: `start-service.bat`

## Support

For issues:
1. Check Event Viewer logs
2. Verify service status in `services.msc`
3. Test API endpoint manually
4. Review this documentation