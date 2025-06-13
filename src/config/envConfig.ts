// config/envConfig.ts - SIMPLIFIED VERSION - SOPS ONLY
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import logger from "../utils/logging";

/**
 * SIMPLIFIED CONFIG LOADER - SOPS ONLY
 * 
 * This version removes all .env complexity and focuses on SOPS decryption.
 * Clean, simple, and maintainable.
 */

/**
 * Get client ID from CLI args or environment
 */
const getClientId = (): string => {
  const cliArgs = process.argv.slice(2);
  const cliClientId = cliArgs.find(arg => !arg.startsWith('--'));
  
  if (cliClientId) {
    logger.system(`Using CLIENT_ID from CLI: ${cliClientId}`);
    return cliClientId;
  }
  
  if (process.env.CLIENT_ID) {
    logger.system(`Using CLIENT_ID from ENV: ${process.env.CLIENT_ID}`);
    return process.env.CLIENT_ID;
  }
  
  logger.system(`Using default CLIENT_ID: core-dev`);
  return 'core-dev';
};

/**
 * Get GPG passphrase from environment or CLI argument
 */
const getGPGPassphrase = (): string => {
  if (process.env.GPG_PASSPHRASE) {
    logger.system('Using GPG passphrase from environment');
    return process.env.GPG_PASSPHRASE;
  }
  
  const passphraseArg = process.argv.find(arg => arg.startsWith('--gpg-passphrase='));
  if (passphraseArg) {
    logger.system('Using GPG passphrase from CLI argument');
    return passphraseArg.split('=')[1];
  }
  
  throw new Error('GPG passphrase not found. Set GPG_PASSPHRASE env var or use --gpg-passphrase=xxx');
};

/**
 * Get SOPS binary path for Windows
 */
const getSopsPath = (envsRepoPath: string): string => {
  const winPath = path.join(envsRepoPath, 'tools/win64/sops.exe');
  if (!fs.existsSync(winPath)) {
    throw new Error(`SOPS Windows binary not found at: ${winPath}`);
  }
  return winPath;
};

/**
 * Decrypt SOPS file using spawn for better process control
 */
const decryptSopsAsync = async (sopsPath: string, secretsPath: string, gpgPassphrase: string): Promise<string> => {
  logger.system('🔐 Decrypting SOPS file...');
  
  return new Promise((resolve, reject) => {
    const gnupgHome = process.env.GNUPGHOME || path.join(process.env.APPDATA!, 'gnupg');
    
    logger.debug('SOPS Environment details', {
      sops_path: sopsPath,
      secrets_path: secretsPath,
      gnupg_home: gnupgHome,
      ...(logger.isVerbose() && {
        verbose_full_env: {
          GNUPGHOME: gnupgHome,
          GPG_TTY: process.platform === 'win32' ? undefined : '/dev/null',
          GPG_BATCH: '1'
        }
      })
    });
    
    const sopsProcess = spawn(sopsPath, [
      '-d', 
      '--output-type', 
      'json', 
      secretsPath
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env,
        GNUPGHOME: gnupgHome,
        GPG_PASSPHRASE: gpgPassphrase,
        GPG_TTY: process.platform === 'win32' ? undefined : '/dev/null',
        GPG_BATCH: '1'
      },
      shell: true,
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';

    sopsProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    sopsProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    sopsProcess.on('close', (code) => {
      if (code === 0) {
        logger.system('SOPS decryption successful');
        resolve(stdout);
      } else {
        logger.error('SOPS decryption failed', {
          exit_code: code,
          stderr: stderr
        });
        reject(new Error(`SOPS decryption failed: ${stderr}`));
      }
    });

    sopsProcess.on('error', (error) => {
      logger.error('SOPS process error', {
        error: error.message
      });
      reject(error);
    });
  });
};

/**
 * Load configuration using SOPS only
 */
const loadConfig = async () => {
  console.log('🔧 Loading config via SOPS');
  
  const clientId = getClientId();
  const gpgPassphrase = getGPGPassphrase();
  
  const envsRepoPath = path.resolve(__dirname, '../../../core-envs-private');
  
  if (!fs.existsSync(envsRepoPath)) {
    throw new Error(`core-envs-private repo not found at: ${envsRepoPath}`);
  }
  
  console.log(`📂 Using repo: ${envsRepoPath}`);
  
  try {
    // 1. Load config.yaml (public configuration)
    const yamlPath = path.join(envsRepoPath, `clients/${clientId}/config.yaml`);
    if (!fs.existsSync(yamlPath)) {
      throw new Error(`Client config.yaml not found: ${clientId}`);
    }
    
    const yamlFile = fs.readFileSync(yamlPath, 'utf8');
    const yamlParsed = yaml.load(yamlFile) as Record<string, any>;
    
    // Convert snake_case to camelCase for consistency
    const yamlConfig = Object.entries(yamlParsed).reduce((acc, [key, value]) => {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      acc[camelKey] = value;
      return acc;
    }, {} as Record<string, any>);
    
    console.log('✅ config.yaml loaded');
    
    // 2. Decrypt secrets.sops.yaml
    const secretsPath = path.join(envsRepoPath, `clients/${clientId}/secrets.sops.yaml`);
    if (!fs.existsSync(secretsPath)) {
      throw new Error(`Client secrets.sops.yaml not found: ${clientId}`);
    }
    
    console.log(`🔐 Decrypting secrets for: ${clientId}`);
    
    const sopsPath = getSopsPath(envsRepoPath);
    console.log(`🔧 Using SOPS: ${sopsPath}`);
    
    const decryptOutput = await decryptSopsAsync(sopsPath, secretsPath, gpgPassphrase);
    const secretsConfig = JSON.parse(decryptOutput);
    console.log('✅ Secrets decrypted successfully');
    
    // 3. Merge configs with proper field mapping
    const mergedConfig = {
      ...yamlConfig,
      ...secretsConfig,
      
      // Map snake_case to camelCase for key fields
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
      
      // Browser Pool Configuration
      maxBrowsers: yamlConfig.maxBrowsers ?? secretsConfig.max_browsers ?? 2,
      maxPagesPerBrowser: yamlConfig.maxPagesPerBrowser ?? secretsConfig.max_pages_per_browser ?? 3,
      pageIdleTimeout: yamlConfig.pageIdleTimeout ?? secretsConfig.page_idle_timeout ?? 300000,      

      // Build URLs from config
      coreApiHost: yamlConfig.coreApiHost ?? '',
      servicesPort: yamlConfig.servicesPort ?? '',
      authUrl: yamlConfig.authUrl ?? '',
      backendUrl: yamlConfig.backendUrl ?? '',
      apiUrl: `${yamlConfig.coreApiHost}:${yamlConfig.servicesPort}${yamlConfig.backendUrl}`,
      authFullUrl: `${yamlConfig.coreApiHost}:${yamlConfig.servicesPort}${yamlConfig.authUrl}`,
      
      // Certificate configuration
      certPdfSignType: yamlConfig.certPdfSignType ?? 'p12',
      certPdfSignPath: secretsConfig.cert_pdf_sign_path ?? yamlConfig.certPdfSignPath ?? '',
      certPdfSignPassword: secretsConfig.cert_pdf_sign_password ?? yamlConfig.certPdfSignPassword ?? '',

      
      
      // Metadata
      config_source: 'SOPS_ONLY'
    };
    
    console.log('✅ Config loaded successfully via SOPS');
    
    return mergedConfig;
    
  } catch (error) {
    console.error('❌ Config loading failed:', (error as Error).message);
    throw error;
  }
};

// Exports
export const getConfig = loadConfig;
export const getConfigAsync = loadConfig;
export default null;