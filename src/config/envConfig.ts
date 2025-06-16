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
/**
 * Get SOPS binary path based on platform
 */
const getSopsPath = (envsRepoPath: string): string => {
  // ?? EN LINUX: usar sops del sistema
  if (process.platform === 'linux' || process.platform === 'darwin') {
    return 'sops'; // Asume que está en el PATH
  }
  
  // En Windows, buscar el .exe local
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
    //const gnupgHome = process.env.GNUPGHOME || path.join(process.env.APPDATA!, 'gnupg');

    // ?? FIX: APPDATA no existe en Linux
    let gnupgHome = process.env.GNUPGHOME;
    if (!gnupgHome) {
      if (process.platform === 'win32') { 
        gnupgHome = path.join(process.env.APPDATA!, 'gnupg');
      } else {
        gnupgHome = path.join(process.env.HOME!, '.gnupg');
      }
    }
    
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

  // ?? DEBUG: Ver qué valor tiene __dirname
  console.log('DEBUG __dirname:', __dirname);
  console.log('DEBUG process.cwd():', process.cwd());
  
  const envsRepoPath = path.resolve(__dirname, '../../../core-envs-private');

  // ?? DEBUG: Ver la ruta construida
  console.log('DEBUG envsRepoPath:', envsRepoPath);
  
  if (!fs.existsSync(envsRepoPath)) {
    throw new Error(`core-envs-private repo not found at: ${envsRepoPath}`);
  }
  
  console.log(`📂 Using repo: ${envsRepoPath}`);
  
  try {
    // 1. Load config.yaml (NUEVA ESTRUCTURA)
    const yamlPath = path.join(envsRepoPath, `clients/${clientId}/config.yaml`);
    const yamlFile = fs.readFileSync(yamlPath, 'utf8');
    const yamlParsed = yaml.load(yamlFile) as any;
    
    console.log('✅ config.yaml loaded with new structure');
    
    // 2. Decrypt secrets.sops.yaml
    const secretsPath = path.join(envsRepoPath, `clients/${clientId}/secrets.sops.yaml`);
    const sopsPath = getSopsPath(envsRepoPath);
    const decryptOutput = await decryptSopsAsync(sopsPath, secretsPath, gpgPassphrase);
    const secretsConfig = JSON.parse(decryptOutput);
    
    // 3. 🔥 NUEVO MAPEO PARA ARRAYS
    const coreServicesConfig = yamlParsed.services?.find((s: any) => s.name === 'core-services');
    const coreBackendConfig = yamlParsed.services?.find((s: any) => s.name === 'core-backend');
    const ms365Config = yamlParsed.external_services?.find((s: any) => s.name === 'ms365');
    
    // Buscar credenciales correspondientes
    const coreServicesSecrets = secretsConfig.services?.find((s: any) => s.name === 'core-services')?.credentials || {};
    const coreBackendSecrets = secretsConfig.services?.find((s: any) => s.name === 'core-backend')?.credentials || {};
    const ms365Secrets = secretsConfig.external_services?.find((s: any) => s.name === 'ms365')?.credentials || {};
    
    // 4. Construir config final con la nueva estructura
    const mergedConfig = {
      // Tenant info
      tenantClientId: yamlParsed.tenant?.client_id || '',
      tenantName: yamlParsed.tenant?.name || '',
      environment: yamlParsed.tenant?.environment || 'development',
      // Hot reload configuration
      configReloadIntervalMinutes: yamlParsed.tenant?.config_reload_interval_minutes || 0,
      
      // Core Services config
      coreApiHost: coreServicesConfig?.host || 'http://localhost',
      servicesPort: coreServicesConfig?.port || 3001,
      authUrl: coreServicesConfig?.endpoints?.auth || '/auth/login',      
      
      // Backend config  
      backendPort: coreBackendConfig?.port || 3000,
      backendUrl: coreBackendConfig?.api_url || '',
      
      // Database config (from core-backend)
      pg_host: coreBackendConfig?.database?.host || 'localhost',
      pg_port: coreBackendConfig?.database?.port || 5432,
      pg_database: coreBackendConfig?.database?.name || 'core_dev',
      pg_ssl: coreBackendConfig?.database?.ssl?.enabled || true,
      pg_min_connections: coreBackendConfig?.database?.pool?.min || 2,
      pg_max_connections: coreBackendConfig?.database?.pool?.max || 20,
      
      // MS365 / Email config
      senderEmail: ms365Secrets.sender_email || '',
      clientId: ms365Secrets.client_id || '',
      clientSecret: ms365Secrets.client_secret || '',
      tenantId: ms365Secrets.tenant_id || '',
      refreshToken: ms365Secrets.refresh_token || '',
      tokenEndpoint: ms365Config?.endpoints?.token || 'https://login.microsoftonline.com',
      
      // Auth credentials
      jwtSecret: coreServicesSecrets.jwt_secret || '',
      internalJwtSecret: coreServicesSecrets.internal_jwt_secret || '',
      authUsername: coreServicesSecrets.auth?.username || '',
      authPassword: coreServicesSecrets.auth?.password || '',
      
      // PDF signing
      certPdfSignPath: coreServicesConfig?.certificates?.pdf_signing?.path || '',
      certPdfSignType: coreServicesConfig?.certificates?.pdf_signing?.type || 'p12',
      certPdfSignPassword: coreServicesSecrets.certificates?.pdf_signing_password || '',
      
      // Browser pool
      maxBrowsers: coreServicesConfig?.browser_pool?.max_browsers || 1,
      maxPagesPerBrowser: coreServicesConfig?.browser_pool?.pdf_generation?.max_pages_per_browser || 2,
      pageIdleTimeout: coreServicesConfig?.browser_pool?.pdf_generation?.page_idle_timeout || 60000,
      
      // Build URLs
      apiUrl: `${coreServicesConfig?.host}:${coreServicesConfig?.port}/api`,
      authFullUrl: `${coreServicesConfig?.host}:${coreServicesConfig?.port}${coreServicesConfig?.endpoints?.auth}`,
      
      // Metadata
      config_source: 'SOPS_ARRAY_STRUCTURE'
    };
    
    console.log('✅ Config loaded with new array structure');
    
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