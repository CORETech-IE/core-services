# core-services

**Multi-client backend service for PDF/ZPL generation, email sending, and logging.**

This service loads **client-specific configuration** securely from encrypted files using [SOPS](https://github.com/getsops/sops) and [GPG](https://gnupg.org/).

---

## 🧠 What This Service Does

- Generates PDFs from templates.
- Generates ZPL (Zebra label printer) content.
- Sends emails via OAuth2 SMTP (e.g., Microsoft 365).
- Emits job logs with traceability.
- All configuration is **per client**, securely encrypted.

---

## ⚙️ Requirements

1. **Node.js** (v18 or later)
2. **npm**
3. **Git**
4. **SOPS** (You can use `sops.exe` on Windows)
5. A cloned copy of the private configuration repo: `core-envs-private`

Folder layout must look like this:

```
C:/CORE/GitHub/
├── core-services/
└── core-envs-private/
```

---

## 🔐 Initial Setup

### 1. Clone the configuration repo

```bash
cd C:/CORE/GitHub/
git clone git@github.com:yourorg/core-envs-private.git
```

### 2. Decrypt secrets

Replace `core-dev` with your client ID:

```bash
cd core-services/
sops -d ../core-envs-private/clients/core-dev/secrets.sops.yaml > .env
```

This will create a temporary `.env` file used by the app.

### 3. Install dependencies

```bash
npm install
```

---

## 🚀 Run in development

Replace `core-dev` with the desired client:

```bash
npm run dev -- core-dev
```

---

## 📁 Folder structure

```
core-services/
├── src/
│   ├── config/           # Loads YAML config for a client
│   ├── controllers/      # Routes for PDF/ZPL/Email/etc.
│   ├── middlewares/      # Security, logging, etc.
│   └── utils/            # Helpers and logging
├── .env                  # Decrypted secrets (from SOPS)
├── package.json
└── tsconfig.json
```

---

## 🛡️ Security Notes

- Do not commit `.env` or any decrypted secret file.
- Use only encrypted `secrets.sops.yaml` from `core-envs-private`.
- You must have GPG access to the right key to decrypt.

---

## 🧯 Troubleshooting

### App crashes on startup?

Check this:

- Did you decrypt secrets using `sops`?
- Is the `.env` file present?
- Did you run with the correct client? (`npm run dev -- core-dev`)
- Are the paths to `core-envs-private` correct?

---

## 🧪 Example Use Flow

```bash
cd C:/CORE/GitHub/core-services

# Step 1: Decrypt secrets
sops -d ../core-envs-private/clients/core-dev/secrets.sops.yaml > .env

# Step 2: Run app
npm start -- core-dev --standalone --gpg-passphrase="thepass"
```

That's it. You're running a secure, client-specific backend service.

----------------

# ===================================================================
# GPG/SOPS SURVIVAL GUIDE - WINDOWS SERVER PRODUCTION
# ===================================================================
# Follow these steps IN ORDER if GPG/SOPS fails in production
# Created after surviving the Windows GPG hell on development

# ===================================================================
# STEP 1: VERIFY GPG INSTALLATION AND VERSION
# ===================================================================

# Check if GPG is installed and get version
gpg --version
# Expected: GPG 2.4.x or similar

# Check if SOPS is available
.\tools\win64\sops.exe --version
# Expected: sops 3.10.2 or similar

# ===================================================================
# STEP 2: LOCATE GPG KEYRING DIRECTORY
# ===================================================================

# Windows Server may use different GPG directories than desktop
# Check these locations in order:

echo "Checking common GPG directories..."

# Location 1: User profile (most common)
dir "C:\Users\%USERNAME%\.gnupg"

# Location 2: AppData Roaming (where keys actually are on desktop)
dir "C:\Users\%USERNAME%\AppData\Roaming\gnupg"

# Location 3: System-wide GPG (if installed as service)
dir "C:\ProgramData\GNU\etc\gnupg"

# Location 4: Service user directory (if running as Windows Service)
dir "C:\Windows\System32\config\systemprofile\.gnupg"

# Set GNUPGHOME to the directory that contains keys
set GNUPGHOME=C:\Users\%USERNAME%\AppData\Roaming\gnupg

# ===================================================================
# STEP 3: VERIFY GPG KEY EXISTS
# ===================================================================

# List all secret keys with long format
gpg --list-secret-keys --keyid-format LONG

# CRITICAL: Look for this specific key ID: 84F09B1D810A6590
# Full fingerprint: EC5A8F24358F986C983BA5F384F09B1D810A6590

# If key is NOT found, proceed to STEP 4
# If key IS found, skip to STEP 5

# ===================================================================
# STEP 4: IMPORT GPG KEY (if missing)
# ===================================================================

# Kill any running GPG processes first
taskkill /f /im gpg-agent.exe 2>nul
taskkill /f /im gpg.exe 2>nul

# Import the production key (prepare this file before deployment)
gpg --import production-key.asc

# Alternative: Import from backup location
gpg --import \\server-share\backups\core-services-gpg-key.asc

# Verify import was successful
gpg --list-secret-keys --keyid-format LONG | findstr "84F09B1D810A6590"

# Set ultimate trust for the key (required for SOPS)
echo "Setting key trust to ultimate..."
echo "84F09B1D810A6590:6:" | gpg --import-ownertrust

# ===================================================================
# STEP 5: TEST GPG FUNCTIONALITY
# ===================================================================

# Test 1: Basic GPG encryption/decryption
echo "test message" | gpg --armor --encrypt --recipient 84F09B1D810A6590 | gpg --decrypt

# Test 2: GPG with passphrase (use production passphrase)
set GPG_PASSPHRASE=kaboom!KOWALSKI@2028
echo "test" | gpg --sign --armor --batch --yes --passphrase "%GPG_PASSPHRASE%" --pinentry-mode loopback

# If tests fail, proceed to STEP 6
# If tests pass, skip to STEP 7

# ===================================================================
# STEP 6: FIX GPG-AGENT ISSUES (Windows Server specific)
# ===================================================================

# Kill all GPG processes
taskkill /f /im gpg-agent.exe 2>nul
taskkill /f /im keyboxd.exe 2>nul

# Remove GPG agent socket files (if they exist)
del "%GNUPGHOME%\S.gpg-agent" 2>nul
del "%GNUPGHOME%\S.gpg-agent.ssh" 2>nul

# Create GPG agent config for Windows Server
echo pinentry-program "C:\Program Files (x86)\gnupg\bin\pinentry-basic.exe" > "%GNUPGHOME%\gpg-agent.conf"
echo default-cache-ttl 600 >> "%GNUPGHOME%\gpg-agent.conf"
echo max-cache-ttl 7200 >> "%GNUPGHOME%\gpg-agent.conf"
echo allow-loopback-pinentry >> "%GNUPGHOME%\gpg-agent.conf"

# Start GPG agent manually
gpg-agent --daemon --use-standard-socket

# Test agent connection
gpg-connect-agent "get_version" /bye

# ===================================================================
# STEP 7: TEST SOPS FUNCTIONALITY
# ===================================================================

# Verify .sops.yaml configuration
type .sops.yaml
# Should contain: pgp: '84F09B1D810A6590'

# Test SOPS decryption manually
set GNUPGHOME=C:\Users\%USERNAME%\AppData\Roaming\gnupg
set GPG_PASSPHRASE=kaboom!KOWALSKI@2028
.\tools\win64\sops.exe -d .\clients\core-dev\secrets.sops.yaml

# If manual SOPS works but Node.js fails, proceed to STEP 8
# If manual SOPS fails, check STEP 9

# ===================================================================
# STEP 8: NODE.JS ENVIRONMENT VARIABLES
# ===================================================================

# Set environment variables for Node.js process
# CRITICAL: Use the SAME path where keys were found in STEP 2

set GNUPGHOME=C:\Users\%USERNAME%\AppData\Roaming\gnupg
set GPG_PASSPHRASE=kaboom!KOWALSKI@2028
set GPG_TTY=CON
set GPG_BATCH=1

# Test Node.js can see GPG keys
node -e "console.log(require('child_process').execSync('gpg --list-secret-keys', {encoding:'utf8'}))"

# If Node.js still can't see keys, the GNUPGHOME path is wrong
# Double-check the path and verify Node.js user context

# ===================================================================
# STEP 9: TROUBLESHOOTING COMMON ISSUES
# ===================================================================

# Issue 1: "No secret key" error
# Solution: Verify key import and trust level
gpg --edit-key 84F09B1D810A6590
# In GPG prompt: trust > 5 > y > quit

# Issue 2: "Could not load secring" error  
# Solution: Modern GPG doesn't use secring.gpg, this is normal
# Ensure you're using GPG 2.x, not 1.x

# Issue 3: Permission denied on GPG directory
# Solution: Fix permissions (if running as service user)
icacls "%GNUPGHOME%" /grant "%USERNAME%:F" /t

# Issue 4: Different user contexts (Service vs Interactive)
# Solution: Copy GPG directory to service user profile
xcopy /s "C:\Users\%USERNAME%\AppData\Roaming\gnupg\*" "C:\Windows\System32\config\systemprofile\.gnupg\"

# Issue 5: SOPS "no matching creation rules"
# Solution: Verify .sops.yaml path_regex matches file path
# Use: path_regex: .* (matches everything)

# ===================================================================
# STEP 10: EMERGENCY PROCEDURES
# ===================================================================

# If all else fails, nuclear reset and reimport:

# 1. Stop application
net stop "Core Services" 2>nul

# 2. Kill all GPG processes  
taskkill /f /im gpg-agent.exe 2>nul
taskkill /f /im gpg.exe 2>nul

# 3. Remove GPG directory
rmdir /s /q "%GNUPGHOME%" 2>nul

# 4. Recreate and import key
mkdir "%GNUPGHOME%"
gpg --import production-key.asc
echo "84F09B1D810A6590:6:" | gpg --import-ownertrust

# 5. Test and restart
.\tools\win64\sops.exe -d .\clients\core-dev\secrets.sops.yaml
net start "Core Services"

# ===================================================================
# PRODUCTION DEPLOYMENT CHECKLIST
# ===================================================================

# Before deploying to Windows Server:
# [ ] Backup current GPG keys: gpg --armor --export-secret-keys > backup.asc
# [ ] Verify .sops.yaml contains correct key ID: 84F09B1D810A6590  
# [ ] Test SOPS decryption manually on target server
# [ ] Verify Node.js can access GPG from service user context
# [ ] Set correct GNUPGHOME environment variable for service
# [ ] Test with production passphrase: ASK IT/DEV
# [ ] Verify file permissions on GPG directory
# [ ] Test application startup in service mode

# ===================================================================
# EMERGENCY CONTACTS & NOTES
# ===================================================================

# Key Information:
# - Key ID: 84F09B1D810A6590
# - Full Fingerprint: EC5A8F24358F986C983BA5F384F09B1D810A6590  
# - Email: core-services@coretechnology.ie
# - Passphrase: ASK IT/DEV
# - Created: 2025-06-12
# - Expires: 2026-06-12

# Expected GPG Directory (Windows Server):
# Interactive User: C:\Users\%USERNAME%\AppData\Roaming\gnupg
# Service User: C:\Windows\System32\config\systemprofile\.gnupg

# If GPG still fails after following this guide:
# 1. Check Windows Event Log for GPG errors
# 2. Verify Gpg4win is properly installed
# 3. Consider using gpg 1.x as fallback (if available)
# 4. Contact system administrator for Windows Service permissions

# Last resort: Run application as interactive user instead of service
# (not recommended for production, but works for emergency fixes)