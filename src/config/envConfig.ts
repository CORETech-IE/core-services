// config/envConfig.ts
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';

interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Determines configuration mode based on environment and CLI args
 */
const getConfigMode = (): 'standalone' | 'traditional' => {
  if (process.argv.includes('--standalone')) return 'standalone';
  if (process.env.CONFIG_MODE === 'standalone') return 'standalone';
  
  // Auto-detection for Windows Service
  if (process.platform === 'win32' && process.env.NODE_ENV === 'production') {
    return 'standalone';
  }
  
  // Check for SOPS binary (platform-specific)
  let hasSOPS = false;
  if (process.platform === 'win32') {
    hasSOPS = fs.existsSync(path.join(__dirname, '../../tools/win64/sops.exe'));
  } else {
    // Linux: check multiple locations
    const linuxSopsPaths = [
      path.join(__dirname, '../../tools/linux/sops'),
      path.join(__dirname, '../../tools/sops'),
      '/usr/local/bin/sops',
      '/usr/bin/sops'
    ];
    hasSOPS = linuxSopsPaths.some(p => fs.existsSync(p));
    
    // Also check if sops is in PATH
    if (!hasSOPS) {
      try {
        execSync('which sops', { stdio: 'pipe' });
        hasSOPS = true;
      } catch {
        // sops not in PATH
      }
    }
  }
  
  const hasEnv = fs.existsSync(path.join(__dirname, '../.env'));
  
  if (hasSOPS && !hasEnv) return 'standalone';
  return 'traditional';
};

/**
 * Get GPG passphrase from multiple sources with fallback
 */
const getGPGPassphrase = (): string => {
  // 1. Environment variable (highest priority)
  if (process.env.GPG_PASSPHRASE) {
    console.log('?? Using GPG passphrase from environment');
    return process.env.GPG_PASSPHRASE;
  }
  
  // 2. CLI argument --gpg-passphrase
  const passphraseArg = process.argv.find(arg => arg.startsWith('--gpg-passphrase='));
  if (passphraseArg) {
    console.log('?? Using GPG passphrase from CLI argument');
    return passphraseArg.split('=')[1];
  }
  
  // 3. Windows Service Registry (for production)
  if (process.platform === 'win32' && process.env.NODE_ENV === 'production') {
    try {
      const regValue = execSync(
        'reg query "HKLM\\SOFTWARE\\CoreServices" /v GPGPassphrase 2>nul', 
        { encoding: 'utf8', timeout: 5000 }
      );
      const match = regValue.match(/GPGPassphrase\s+REG_SZ\s+(.+)/);
      if (match) {
        console.log('?? Using GPG passphrase from Windows Registry');
        return match[1].trim();
      }
    } catch (error) {
      console.warn('?? Could not read GPG passphrase from Windows Registry');
    }
  }
  
  // 4. File-based fallback (encrypted file in secure location)
  const securePassphraseFile = path.join(process.cwd(), 'secure', 'gpg.key');
  if (fs.existsSync(securePassphraseFile)) {
    try {
      const encryptedPassphrase = fs.readFileSync(securePassphraseFile, 'utf8').trim();
      const passphrase = Buffer.from(encryptedPassphrase, 'base64').toString('utf8');
      console.log('?? Using GPG passphrase from secure file');
      return passphrase;
    } catch (error) {
      console.warn('?? Could not read GPG passphrase from secure file');
    }
  }
  
  throw new Error('GPG passphrase not found. Set GPG_PASSPHRASE environment variable or use --gpg-passphrase=xxx');
};

/**
 * Get SOPS binary path based on platform
 */
const getSopsPath = (envsRepoPath: string): string => {
  if (process.platform === 'win32') {
    const winPath = path.join(envsRepoPath, 'tools/win64/sops.exe');
    if (!fs.existsSync(winPath)) {
      throw new Error(`SOPS Windows binary not found at: ${winPath}`);
    }
    return winPath;
  } else {
    // Linux/Unix - try multiple locations
    const linuxPaths = [
      path.join(envsRepoPath, 'tools/linux/sops'),
      path.join(envsRepoPath, 'tools/sops'),
      '/usr/local/bin/sops',
      '/usr/bin/sops',
      'sops' // PATH lookup
    ];
    
    for (const sopsPath of linuxPaths) {
      try {
        if (sopsPath === 'sops') {
          execSync('which sops', { stdio: 'pipe' });
          console.log(`?? Using SOPS from PATH`);
          return 'sops';
        } else if (fs.existsSync(sopsPath)) {
          // Make sure it's executable
          try {
            fs.chmodSync(sopsPath, 0o755);
          } catch (chmodError) {
            console.warn(`?? Could not set executable permissions on ${sopsPath}`);
          }
          console.log(`?? Using SOPS binary: ${sopsPath}`);
          return sopsPath;
        }
      } catch (error) {
        continue;
      }
    }
    
    throw new Error(`SOPS binary not found. Install with: curl -LO https://github.com/mozilla/sops/releases/download/v3.7.3/sops-v3.7.3.linux.amd64 && sudo mv sops-v3.7.3.linux.amd64 /usr/local/bin/sops && sudo chmod +x /usr/local/bin/sops`);
  }
};

/**
 * Decrypt SOPS file with Windows-specific optimizations
 */
const decryptSopsWindows = (sopsPath: string, secretsPath: string, gpgPassphrase: string): string => {
  console.log('?? Windows SOPS decryption with optimizations...');
  
  // Pre-cache GPG passphrase
  try {
    execSync(`echo test | gpg --sign --armor --batch --yes --passphrase "${gpgPassphrase}" --pinentry-mode loopback`, {
      stdio: 'pipe',
      timeout: 10000,
      env: {
        ...process.env,
        GNUPGHOME: process.env.GNUPGHOME || path.join(os.homedir(), '.gnupg'),
      }
    });
    console.log('? GPG passphrase cached successfully');
  } catch (error) {
    console.warn('?? GPG pre-cache failed:', (error as Error).message);
  }
  
  // Execute SOPS
  const decryptOutput = execSync(`"${sopsPath}" -d --output-type json "${secretsPath}"`, {
    encoding: 'utf8',
    timeout: 30000,
    env: {
      ...process.env,
      GNUPGHOME: process.env.GNUPGHOME || path.join(os.homedir(), '.gnupg'),
      GPG_PASSPHRASE: gpgPassphrase
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  console.log('? SOPS decryption successful (Windows)');
  return decryptOutput;
};

/**
 * Decrypt SOPS file with Linux-specific optimizations (GPG POPUP KILLER)
 */
const decryptSopsLinux = (sopsPath: string, secretsPath: string, gpgPassphrase: string): string => {
  console.log('?? Linux SOPS decryption starting (killing GPG popups)...');
  
  try {
    // Method 1: FORCE GPG to use our passphrase (NO POPUPS!)
    const result = execSync(`"${sopsPath}" -d --output-type json "${secretsPath}"`, {
      encoding: 'utf8',
      env: {
        ...process.env,
        GPG_PASSPHRASE: gpgPassphrase,
        GPG_TTY: '/dev/null',              // ? KILL TTY
        DISPLAY: '',                       // ? KILL X11 POPUPS  
        GPG_AGENT_INFO: '',               // ? DISABLE AGENT
        GPG_BATCH: '1',                   // ? BATCH MODE
        GNUPGHOME: process.env.GNUPGHOME || path.join(os.homedir(), '.gnupg')
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000
    });
    
    console.log('? SOPS decryption successful (Linux Method 1 - No popups)');
    return result;
    
  } catch (error1) {
    console.log('?? Method 1 failed, trying Method 2 (pipe passphrase)...');
    
    try {
      // Method 2: Pipe passphrase directly + kill all interactive stuff
      const result = execSync(`echo "${gpgPassphrase}" | "${sopsPath}" -d --output-type json "${secretsPath}"`, {
        encoding: 'utf8',
        env: {
          ...process.env,
          GPG_BATCH: '1',
          GPG_USE_AGENT: '0',              // ? NO AGENT
          GPG_TTY: '/dev/null',            // ? NO TTY
          DISPLAY: '',                     // ? NO X11
          GNUPGHOME: process.env.GNUPGHOME || path.join(os.homedir(), '.gnupg')
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000,
        shell: '/bin/bash'
      });
      
      console.log('? SOPS decryption successful (Linux Method 2 - Piped passphrase)');
      return result;
      
    } catch (error2) {
      console.log('?? Method 2 failed, trying Method 3 (hardcore script)...');
      
      try {
        // Method 3: Nuclear option - script with ALL GPG popup killers
        const tempScript = path.join(os.tmpdir(), `decrypt-${Date.now()}.sh`);
        const scriptContent = `#!/bin/bash
# NUCLEAR GPG POPUP KILLER SCRIPT
export GNUPGHOME="${process.env.GNUPGHOME || path.join(os.homedir(), '.gnupg')}"
export GPG_BATCH=1
export GPG_USE_AGENT=0
export GPG_TTY=/dev/null
export DISPLAY=""
export GPG_AGENT_INFO=""
unset SSH_AGENT_PID
unset SSH_AUTH_SOCK
# Pre-load passphrase into gpg-agent cache
echo "test" | gpg --batch --yes --passphrase "${gpgPassphrase}" --pinentry-mode loopback --symmetric --cipher-algo AES256 --output /dev/null 2>/dev/null || true
# Now decrypt with SOPS
echo "${gpgPassphrase}" | "${sopsPath}" -d --output-type json "${secretsPath}"`;
        
        fs.writeFileSync(tempScript, scriptContent, { mode: 0o755 });
        
        const result = execSync(`bash "${tempScript}"`, {
          encoding: 'utf8',
          env: {
            ...process.env,
            GPG_BATCH: '1',
            GPG_USE_AGENT: '0',
            GPG_TTY: '/dev/null',
            DISPLAY: ''
          },
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 30000
        });
        
        // Clean up immediately
        fs.unlinkSync(tempScript);
        
        console.log('? SOPS decryption successful (Linux Method 3 - Nuclear option)');
        return result;
        
      } catch (error3) {
        // Clean up script if it exists
        const tempScript = path.join(os.tmpdir(), `decrypt-${Date.now()}.sh`);
        if (fs.existsSync(tempScript)) {
          fs.unlinkSync(tempScript);
        }
        
        console.error('? All SOPS decryption methods failed on Linux (even the nuclear option):');
        console.error('   Method 1 (env):', (error1 as Error).message.substring(0, 200));
        console.error('   Method 2 (echo):', (error2 as Error).message.substring(0, 200));
        console.error('   Method 3 (nuclear):', (error3 as Error).message.substring(0, 200));
        console.error('?? Try running: gpgconf --kill gpg-agent && gpg-agent --daemon');
        
        throw new Error('SOPS decryption failed with all methods on Linux. GPG is being stubborn.');
      }
    }
  }
};

/**
 * Standalone config loading with cross-platform SOPS support
 */
const loadStandaloneConfig = async () => {
  console.log('?? Loading config via SOPS from local repo (Standalone Mode)');
  
  const clientId = getClientId();
  const gpgPassphrase = getGPGPassphrase();
  
  // Use local core-envs-private repo (sibling directory)
  const envsRepoPath = path.resolve(__dirname, '../../../core-envs-private');
  
  if (!fs.existsSync(envsRepoPath)) {
    throw new Error(`core-envs-private repo not found at: ${envsRepoPath}`);
  }
  
  console.log(`?? Using local repo: ${envsRepoPath}`);
  console.log(`??? Platform: ${process.platform}`);
  
  try {
    // 1. Load config.yaml (non-encrypted)
    const yamlPath = path.join(envsRepoPath, `clients/${clientId}/config.yaml`);
    if (!fs.existsSync(yamlPath)) {
      throw new Error(`Client config.yaml not found: ${clientId}`);
    }
    
    const yamlFile = fs.readFileSync(yamlPath, 'utf8');
    const yamlParsed = yaml.load(yamlFile) as Record<string, any>;
    
    const yamlConfig = Object.entries(yamlParsed).reduce((acc, [key, value]) => {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      acc[camelKey] = value;
      return acc;
    }, {} as Record<string, any>);
    
    console.log('? config.yaml loaded successfully');
    
    // 2. Load and decrypt secrets.sops.yaml IN MEMORY
    const secretsPath = path.join(envsRepoPath, `clients/${clientId}/secrets.sops.yaml`);
    if (!fs.existsSync(secretsPath)) {
      throw new Error(`Client secrets.sops.yaml not found: ${clientId}`);
    }
    
    console.log(`?? Decrypting secrets for client: ${clientId} (${process.platform})`);
    
    // Get platform-specific SOPS path
    const sopsPath = getSopsPath(envsRepoPath);
    console.log(`?? Using SOPS binary: ${sopsPath}`);
    
    // Decrypt using platform-specific method
    let decryptOutput: string;
    if (process.platform === 'win32') {
      decryptOutput = decryptSopsWindows(sopsPath, secretsPath, gpgPassphrase);
    } else {
      decryptOutput = decryptSopsLinux(sopsPath, secretsPath, gpgPassphrase);
    }
    
    const secretsConfig = JSON.parse(decryptOutput);
    console.log('? Secrets decrypted successfully in memory');
    
    // 3. Merge configs (secrets override yaml)
    const mergedConfig = {
      ...yamlConfig,
      ...secretsConfig,
      // Map snake_case to camelCase
      senderEmail: secretsConfig.sender_email ?? yamlConfig.senderEmail ?? '',
      clientId: secretsConfig.client_id ?? yamlConfig.clientId ?? '',
      clientSecret: secretsConfig.client_secret ?? yamlConfig.clientSecret ?? '',
      tenantId: secretsConfig.tenant_id ?? yamlConfig.tenantId ?? '',
      refreshToken: secretsConfig.refresh_token ?? yamlConfig.refreshToken ?? '',
      tenantClientId: secretsConfig.tenant_client_id ?? yamlConfig.tenantClientId ?? '',
      tokenEndpoint: secretsConfig.token_endpoint ?? yamlConfig.tokenEndpoint ?? 'https://login.microsoftonline.com',
      jwtSecret: secretsConfig.jwt_secret ?? yamlConfig.jwtSecret ?? '',
      internalJwtSecret: secretsConfig.internal_jwt_secret ?? yamlConfig.internalJwtSecret ?? '',
      authUsername: secretsConfig.auth_username ?? yamlConfig.authUsername,
      authPassword: secretsConfig.auth_password ?? yamlConfig.authPassword,
      
      // Composed URLs
      coreApiHost: yamlConfig.coreApiHost ?? '',
      servicesPort: yamlConfig.servicesPort ?? '',
      authUrl: yamlConfig.authUrl ?? '',
      backendUrl: yamlConfig.backendUrl ?? '',
      apiUrl: `${yamlConfig.coreApiHost}:${yamlConfig.servicesPort}${yamlConfig.backendUrl}`,
      authFullUrl: `${yamlConfig.coreApiHost}:${yamlConfig.servicesPort}${yamlConfig.authUrl}`,
      
      // Certificate config
      certPdfSignType: yamlConfig.certPdfSignType ?? 'p12',
      certPdfSignPath: secretsConfig.cert_pdf_sign_path ?? yamlConfig.certPdfSignPath ?? '',
      certPdfSignPassword: secretsConfig.cert_pdf_sign_password ?? yamlConfig.certPdfSignPassword ?? '',
      
      // Mark as standalone mode
      standalone_mode: true,
      config_source: `SOPS_LOCAL_${process.platform.toUpperCase()}`
    };
    
    console.log(`? Config loaded successfully in standalone mode (${process.platform})`);
    console.log('?? All secrets loaded in memory - no plaintext files created');
    
    return mergedConfig;
    
  } catch (error) {
    console.error(`? Standalone config loading failed on ${process.platform}:`, (error as Error).message);
    throw error;
  }
};

/**
 * Traditional mode (unchanged)
 */
const loadTraditionalConfig = () => {
  console.log('?? Loading config via .env + YAML (traditional mode)');
  
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    // Read .env manually to avoid dotenv dependency in standalone
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = envContent
      .split('\n')
      .filter(line => line.includes('=') && !line.startsWith('#'))
      .reduce((acc, line) => {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        acc[key.trim()] = value.replace(/^["']|["']$/g, ''); // Remove quotes
        return acc;
      }, {} as Record<string, string>);
    
    // Set environment variables
    Object.assign(process.env, envVars);
    console.log(`? Loaded .env from: ${envPath}`);
  } else {
    console.warn(`?? .env not found at: ${envPath}`);
  }

  const clientId = getClientId();
  const yamlPath = path.resolve(__dirname, `../../../core-envs-private/clients/${clientId}/config.yaml`);
  let yamlConfig: Record<string, any> = {};
  
  try {
    const file = fs.readFileSync(yamlPath, 'utf8');
    const parsed = yaml.load(file) as Record<string, any>;
    
    yamlConfig = Object.entries(parsed).reduce((acc, [key, value]) => {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      acc[camelKey] = value;
      return acc;
    }, {} as Record<string, any>);
    
    console.log(`? Loaded config.yaml from: ${yamlPath}`);
  } catch (err) {
    console.warn(`?? Failed to load config.yaml at ${yamlPath}:`, err);
  }

  return {
    ...yamlConfig,
    senderEmail: process.env.sender_email ?? yamlConfig.senderEmail ?? '',
    clientId: process.env.client_id ?? yamlConfig.clientId ?? '',
    clientSecret: process.env.client_secret ?? yamlConfig.clientSecret ?? '',
    tenantId: process.env.tenant_id ?? yamlConfig.tenantId ?? '',
    refreshToken: process.env.refresh_token ?? yamlConfig.refreshToken ?? '',
    tenantClientId: process.env.tenant_client_id ?? yamlConfig.tenantClientId ?? '',
    tokenEndpoint: process.env.token_endpoint ?? yamlConfig.tokenEndpoint ?? 'https://login.microsoftonline.com',
    jwtSecret: process.env.jwt_secret ?? yamlConfig.jwtSecret ?? '',
    internalJwtSecret: process.env.internal_jwt_secret ?? yamlConfig.internalJwtSecret ?? '',
    authUsername: process.env.auth_username ?? yamlConfig.authUsername,
    authPassword: process.env.auth_password ?? yamlConfig.authPassword,
    
    coreApiHost: yamlConfig.coreApiHost ?? '',
    servicesPort: yamlConfig.servicesPort ?? '',
    authUrl: yamlConfig.authUrl ?? '',
    backendUrl: yamlConfig.backendUrl ?? '',
    apiUrl: `${yamlConfig.coreApiHost}:${yamlConfig.servicesPort}${yamlConfig.backendUrl}`,
    authFullUrl: `${yamlConfig.coreApiHost}:${yamlConfig.servicesPort}${yamlConfig.authUrl}`,
    certPdfSignType: yamlConfig.certPdfSignType ?? 'p12',
    certPdfSignPath: process.env.cert_pdf_sign_path ?? yamlConfig.certPdfSignPath ?? '',
    certPdfSignPassword: process.env.cert_pdf_sign_password ?? yamlConfig.certPdfSignPassword ?? '',
    
    standalone_mode: false,
    config_source: 'ENV_YAML'
  };
};

/**
 * Main config loader
 */
const loadConfig = async () => {
  const mode = getConfigMode();
  
  switch (mode) {
    case 'standalone':
      return await loadStandaloneConfig();
    case 'traditional':
      return loadTraditionalConfig();
    default:
      throw new Error(`Unknown config mode: ${mode}`);
  }
};

/**
 * Get client ID from multiple sources
 */
const getClientId = (): string => {
  // 1. CLI argument
  const cliArgs = process.argv.slice(2);
  const cliClientId = cliArgs.find(arg => !arg.startsWith('--'));
  
  if (cliClientId) {
    console.log(`?? Using CLIENT_ID from CLI: ${cliClientId}`);
    return cliClientId;
  }
  
  // 2. Environment variable
  if (process.env.CLIENT_ID) {
    console.log(`?? Using CLIENT_ID from ENV: ${process.env.CLIENT_ID}`);
    return process.env.CLIENT_ID;
  }
  
  // 3. Windows Registry (Windows Service only)
  if (process.platform === 'win32' && process.env.NODE_ENV === 'production') {
    try {
      const regValue = execSync(
        'reg query "HKLM\\SOFTWARE\\CoreServices" /v ClientID 2>nul', 
        { encoding: 'utf8', timeout: 5000 }
      );
      const match = regValue.match(/ClientID\s+REG_SZ\s+(.+)/);
      if (match) {
        const clientId = match[1].trim();
        console.log(`?? Using CLIENT_ID from Windows Registry: ${clientId}`);
        return clientId;
      }
    } catch (error) {
      console.warn('?? Could not read CLIENT_ID from Windows Registry');
    }
  }
  
  // 4. Default fallback
  console.log(`?? Using default CLIENT_ID: core-dev`);
  return 'core-dev';
};

// Export async config loader
export const getConfig = loadConfig;
export const getConfigAsync = loadConfig;

// No sync initialization for standalone mode
export default null;