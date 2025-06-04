import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';
import yaml from 'js-yaml';

interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,    // Start with 1s
  maxDelayMs: 10000     // Max 10s between retries
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Determines configuration mode based on environment and CLI args
 * Priority: CLI flag > Environment variable > Auto-detection
 */
const getConfigMode = (): 'standalone' | 'traditional' => {
  // 1. CLI argument (highest priority)
  if (process.argv.includes('--standalone')) return 'standalone';
  
  // 2. Environment variable
  if (process.env.CONFIG_MODE === 'standalone') return 'standalone';
  
  // 3. Auto-detection: If SOPS available and no .env, use standalone
  const hasSOPS = fs.existsSync(path.join(__dirname, '../../tools/win64/sops.exe'));
  const hasEnv = fs.existsSync(path.join(__dirname, '../.env'));
  
  if (hasSOPS && !hasEnv) return 'standalone';
  
  // 4. Default fallback
  return 'traditional';
};

/**
 * Load config in STANDALONE mode (Windows Service)
 * Fresh git pull + SOPS decrypt + cleanup
 */
const loadStandaloneConfig = async () => {
  console.log('🔒 Loading config via SOPS with fresh repo pull (with retry logic)');
  
  const clientId = getClientId();
  const retryConfig = DEFAULT_RETRY_CONFIG;
  
  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    const tempDir = path.join(os.tmpdir(), `core-envs-${Date.now()}-attempt${attempt}`);
    
    try {
      console.log(`📥 Attempt ${attempt}/${retryConfig.maxAttempts}: Cloning core-envs-private`);
      
      // 1. Fresh clone with timeout - Use HTTPS for Windows compatibility
      //const repoUrl = process.env.CORE_ENVS_REPO_URL || 'https://github.com/company/core-envs-private.git';
      const repoUrl = /*process.env.CORE_ENVS_REPO_URL ||*/ 'https://github.com/CORETech-IE/core-envs-private.git'; // TO-DO: Use env variable for repo URL!!!!!!!
      console.log(`📥 Cloning from: ${repoUrl}`);
      
      execSync(`git clone "${repoUrl}" "${tempDir}"`, {
        stdio: 'pipe',
        timeout: 30000
      });
      
      // 2. Load config.yaml (non-encrypted)
      const yamlPath = path.join(tempDir, `clients/${clientId}/config.yaml`);
      if (!fs.existsSync(yamlPath)) {
        throw new Error(`Client config.yaml not found: ${clientId}`);
      }
      
      const yamlFile = fs.readFileSync(yamlPath, 'utf8');
      const yamlParsed = yaml.load(yamlFile) as Record<string, any>;
      
      // Convert keys from snake_case to camelCase (mantener tu lógica original)
      const yamlConfig = Object.entries(yamlParsed).reduce((acc, [key, value]) => {
        const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        acc[camelKey] = value;
        return acc;
      }, {} as Record<string, any>);
      
      // 3. Load secrets.sops.yaml (encrypted)
      const secretsPath = path.join(tempDir, `clients/${clientId}/secrets.sops.yaml`);
      if (!fs.existsSync(secretsPath)) {
        throw new Error(`Client secrets.sops.yaml not found: ${clientId}`);
      }
      
      console.log(`🔓 Decrypting secrets for client: ${clientId}`);
      // Use SOPS from local path since it's not in the cloned repo
      const sopsPath = path.resolve('C:/CORE/GitHub/core-envs-private/tools/win64/sops.exe');
      const output = execSync(`"${sopsPath}" -d --output-type json "${secretsPath}"`, {
        encoding: 'utf8',
        timeout: 10000
      });
      
      const secretsConfig = JSON.parse(output);
      
      // 4. Merge configs (secrets override yaml, same logic as original)
      const mergedConfig = {
        ...yamlConfig,
        ...secretsConfig,
        // Mantener tu estructura exacta
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
        
        // URLs compuestas (mantener tu lógica)
        coreApiHost: yamlConfig.coreApiHost ?? '',
        servicesPort: yamlConfig.servicesPort ?? '',
        authUrl: yamlConfig.authUrl ?? '',
        backendUrl: yamlConfig.backendUrl ?? '',
        apiUrl: `${yamlConfig.coreApiHost}:${yamlConfig.servicesPort}${yamlConfig.backendUrl}`,
        authFullUrl: `${yamlConfig.coreApiHost}:${yamlConfig.servicesPort}${yamlConfig.authUrl}`,
        
        // Certificados PDF
        certPdfSignType: yamlConfig.certPdfSignType ?? 'p12',
        certPdfSignPath: secretsConfig.cert_pdf_sign_path ?? yamlConfig.certPdfSignPath ?? '',
        certPdfSignPassword: secretsConfig.cert_pdf_sign_password ?? yamlConfig.certPdfSignPassword ?? '',
      };
      
      // 5. Cleanup successful attempt
      console.log('🗑️ Cleaning up temporary repository');
      execSync(`rmdir /s /q "${tempDir}"`, { stdio: 'pipe' });
      
      console.log(`✅ Config loaded successfully on attempt ${attempt}`);
      return mergedConfig;
      
    } catch (error) {
      // Cleanup failed attempt
      if (fs.existsSync(tempDir)) {
        try {
          execSync(`rmdir /s /q "${tempDir}"`, { stdio: 'pipe' });
        } catch {} // Ignore cleanup errors
      }
      
      console.error(`❌ Attempt ${attempt} failed:`, (error as Error).message);
      
      // If this was the last attempt, throw the error
      if (attempt === retryConfig.maxAttempts) {
        throw new Error(`All ${retryConfig.maxAttempts} attempts failed. Last error: ${(error as Error).message}`);
      }
      
      // Calculate exponential backoff delay
      const delay = Math.min(
        retryConfig.baseDelayMs * Math.pow(2, attempt - 1),
        retryConfig.maxDelayMs
      );
      
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await sleep(delay);
    }
  }
  
  throw new Error('Unexpected error in retry logic');
};

/**
 * Load config in TRADITIONAL mode (Docker/development)
 * Tu lógica original exacta
 */
const loadTraditionalConfig = () => {
  console.log('📄 Loading config via .env + YAML (traditional mode)');
  
  // Load .env from src/.env (TU CÓDIGO ORIGINAL)
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`✅ Loaded .env from: ${envPath}`);
  } else {
    console.warn(`⚠️ .env not found at: ${envPath}`);
  }

  // Load config.yaml from core-envs-private (TU CÓDIGO ORIGINAL pero dynamic client)
  const clientId = getClientId();
  const yamlPath = path.resolve(__dirname, `../../../core-envs-private/clients/${clientId}/config.yaml`);
  let yamlConfig: Record<string, any> = {};
  
  try {
    const file = fs.readFileSync(yamlPath, 'utf8');
    const parsed = yaml.load(file) as Record<string, any>;
    
    // Convert keys from snake_case to camelCase (TU LÓGICA ORIGINAL)
    yamlConfig = Object.entries(parsed).reduce((acc, [key, value]) => {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      acc[camelKey] = value;
      return acc;
    }, {} as Record<string, any>);
    
    console.log(`✅ Loaded config.yaml from: ${yamlPath}`);
  } catch (err) {
    console.warn(`⚠️ Failed to load config.yaml at ${yamlPath}:`, err);
  }

  // Merge with .env variables (TU LÓGICA ORIGINAL EXACTA)
  return {
    ...yamlConfig,
    // Variables de entorno prioritarias (sobre el YAML)
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
    
    // URLs compuestas
    coreApiHost: yamlConfig.coreApiHost ?? '',
    servicesPort: yamlConfig.servicesPort ?? '',
    authUrl: yamlConfig.authUrl ?? '',
    backendUrl: yamlConfig.backendUrl ?? '',
    apiUrl: `${yamlConfig.coreApiHost}:${yamlConfig.servicesPort}${yamlConfig.backendUrl}`,
    authFullUrl: `${yamlConfig.coreApiHost}:${yamlConfig.servicesPort}${yamlConfig.authUrl}`,
    certPdfSignType: yamlConfig.certPdfSignType ?? 'p12',
    certPdfSignPath: process.env.cert_pdf_sign_path ?? yamlConfig.certPdfSignPath ?? '',
    certPdfSignPassword: process.env.cert_pdf_sign_password ?? yamlConfig.certPdfSignPassword ?? '',
  };
};

/**
 * Main config loader - handles both modes
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
 * Priority: CLI arg > ENV var > default
 */
const getClientId = (): string => {
  // 1. CLI argument (from your dev.ts workflow)
  const cliArgs = process.argv.slice(2);
  const cliClientId = cliArgs.find(arg => !arg.startsWith('--'));
  
  if (cliClientId) {
    console.log(`📝 Using CLIENT_ID from CLI: ${cliClientId}`);
    return cliClientId;
  }
  
  // 2. Environment variable (for standalone mode)
  if (process.env.CLIENT_ID) {
    console.log(`📝 Using CLIENT_ID from ENV: ${process.env.CLIENT_ID}`);
    return process.env.CLIENT_ID;
  }
  
  // 3. Default fallback
  console.log(`📝 Using default CLIENT_ID: core-dev`);
  return 'core-dev';
};

// Export async config loader for explicit async usage
export const getConfig = loadConfig;

// Initialize config synchronously for backward compatibility
const initConfigSync = () => {
  const mode = getConfigMode();
  
  if (mode === 'standalone') {
    throw new Error('Standalone mode requires async initialization. Use getConfigAsync() instead of default export.');
  }
  
  // Traditional mode can be loaded synchronously
  return loadTraditionalConfig();
};

// Export both sync (for backward compatibility) and async versions
export const getConfigAsync = loadConfig;

// Export null as default - no sync initialization
export default null;