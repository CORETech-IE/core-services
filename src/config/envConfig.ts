// config/envConfig.ts
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';

/**
 * SOLUCIÓN DEFINITIVA para el problema GPG/SOPS en Windows
 * Usa spawn en lugar de execSync para mejor herencia de entorno
 */

/**
 * Get client ID from CLI args
 */
const getClientId = (): string => {
  const cliArgs = process.argv.slice(2);
  const cliClientId = cliArgs.find(arg => !arg.startsWith('--'));
  
  if (cliClientId) {
    console.log(`🎯 Using CLIENT_ID: ${cliClientId}`);
    return cliClientId;
  }
  
  if (process.env.CLIENT_ID) {
    console.log(`🎯 Using CLIENT_ID from ENV: ${process.env.CLIENT_ID}`);
    return process.env.CLIENT_ID;
  }
  
  console.log(`🎯 Using default CLIENT_ID: core-dev`);
  return 'core-dev';
};

/**
 * Get GPG passphrase from CLI argument
 */
const getGPGPassphrase = (): string => {
  if (process.env.GPG_PASSPHRASE) {
    console.log('🔑 Using GPG passphrase from environment');
    return process.env.GPG_PASSPHRASE;
  }
  
  const passphraseArg = process.argv.find(arg => arg.startsWith('--gpg-passphrase='));
  if (passphraseArg) {
    console.log('🔑 Using GPG passphrase from CLI argument');
    return passphraseArg.split('=')[1];
  }
  
  throw new Error('GPG passphrase not found. Use --gpg-passphrase=xxx');
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
 * SOLUCIÓN DEFINITIVA: Usar spawn en lugar de execSync
 * Esto permite mejor herencia del contexto GPG de PowerShell
 */
const decryptSopsAsync = async (sopsPath: string, secretsPath: string, gpgPassphrase: string): Promise<string> => {
  console.log('🚀 ASYNC SOPS decryption with spawn (herencia completa de entorno)...');
  
  return new Promise((resolve, reject) => {
    // Preparar entorno - usar el mismo GNUPGHOME que PowerShell
    const gnupgHome = process.env.GNUPGHOME || path.join(process.env.APPDATA!, 'gnupg');
    
    console.log('🔍 SOPS Environment:');
    console.log('  SOPS Path:', sopsPath);
    console.log('  Secrets Path:', secretsPath);
    console.log('  GNUPGHOME:', gnupgHome);
    
    // Spawn SOPS con herencia COMPLETA del entorno
    const sopsProcess = spawn(sopsPath, [
      '-d', 
      '--output-type', 
      'json', 
      secretsPath
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env,  // ← HEREDA TODO el contexto de PowerShell
        GNUPGHOME: gnupgHome,
        GPG_PASSPHRASE: gpgPassphrase,
        // Variables adicionales para asegurar funcionamiento
        GPG_TTY: process.platform === 'win32' ? undefined : '/dev/null',
        GPG_BATCH: '1'
      },
      shell: true,  // ← IMPORTANTE en Windows
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
        console.log('✅ SOPS decryption successful with spawn!');
        resolve(stdout);
      } else {
        console.log('❌ SOPS spawn failed with code:', code);
        console.log('❌ STDERR:', stderr);
        
        // FALLBACK: Si spawn falla, intentar método directo con PowerShell
        console.log('🔄 Trying PowerShell fallback...');
        
        try {
          // MÉTODO 1: Test super básico de PowerShell
          console.log('🔬 Testing basic PowerShell functionality...');
          
          const basicTest = execSync('powershell -NoProfile -Command "Write-Host BASIC_TEST_OK"', {
            encoding: 'utf8',
            timeout: 10000
          });
          
          console.log('✅ Basic PowerShell test result:', basicTest.trim());
          
          // MÉTODO 2: Test GPG directamente desde cmd (no PowerShell)
          console.log('🔬 Testing GPG from CMD directly...');
          
          const cmdGpgTest = execSync(`gpg --list-secret-keys --keyid-format LONG`, {
            encoding: 'utf8',
            timeout: 10000,
            env: {
              ...process.env,
              GNUPGHOME: gnupgHome
            }
          });
          
          const hasNewKey = cmdGpgTest.includes('84F09B1D810A6590');
          const hasNewFingerprint = cmdGpgTest.includes('EC5A8F24358F986C983BA5F384F09B1D810A6590');
          
          console.log('🔍 CMD GPG Results:');
          console.log('  - Contains new key (84F09B1D...):', hasNewKey);
          console.log('  - Contains new fingerprint (EC5A8F24...):', hasNewFingerprint);
          console.log('  - GPG output length:', cmdGpgTest.length);
          
          if (!hasNewKey && !hasNewFingerprint) {
            console.log('❌ CMD GPG test shows keys are missing!');
            console.log('📝 Available keys:', cmdGpgTest.split('\n').slice(0, 5).join('\n'));
            reject(new Error('Secret keys not visible even from CMD'));
            return;
          }
          
          // MÉTODO 3: Test SOPS directamente desde cmd
          console.log('🔬 Testing SOPS from CMD directly...');
          
          const cmdSopsResult = execSync(`"${sopsPath}" -d --output-type json "${secretsPath}"`, {
            encoding: 'utf8',
            timeout: 30000,
            env: {
              ...process.env,
              GNUPGHOME: gnupgHome,
              GPG_PASSPHRASE: gpgPassphrase
            }
          });
          
          console.log('✅ CMD SOPS worked! JSON length:', cmdSopsResult.length);
          resolve(cmdSopsResult);
          
        } catch (psError) {
          console.log('❌ ALL methods failed:', (psError as Error).message);
          
          // MÉTODO FINAL: Debug del error específico
          if ((psError as any).stderr) {
            console.log('📝 Error STDERR:', (psError as any).stderr);
          }
          
          reject(new Error(`All SOPS methods failed: ${(psError as Error).message}`));
        }
      }
    });

    sopsProcess.on('error', (error) => {
      console.log('❌ SOPS spawn error:', error.message);
      reject(error);
    });
  });
};

/**
 * Determine if we should use standalone mode
 */
const shouldUseStandalone = (): boolean => {
  if (process.argv.includes('--standalone')) return true;
  if (process.env.CONFIG_MODE === 'standalone') return true;
  
  // Check if SOPS binary exists
  const envsRepoPath = path.resolve(__dirname, '../../../core-envs-private');
  const sopsPath = path.join(envsRepoPath, 'tools/win64/sops.exe');
  const hasSOPS = fs.existsSync(sopsPath);
  
  // Check if .env exists
  const hasEnv = fs.existsSync(path.join(__dirname, '../.env'));
  
  return hasSOPS && !hasEnv;
};

/**
 * Load config in standalone mode (SOPS)
 */
const loadStandaloneConfig = async () => {
  console.log('🔧 Loading config via SOPS (Standalone Mode)');
  
  const clientId = getClientId();
  const gpgPassphrase = getGPGPassphrase();
  
  const envsRepoPath = path.resolve(__dirname, '../../../core-envs-private');
  
  if (!fs.existsSync(envsRepoPath)) {
    throw new Error(`core-envs-private repo not found at: ${envsRepoPath}`);
  }
  
  console.log(`📂 Using repo: ${envsRepoPath}`);
  
  try {
    // 1. Load config.yaml
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
    
    console.log('✅ config.yaml loaded');
    
    // 2. Decrypt secrets.sops.yaml
    const secretsPath = path.join(envsRepoPath, `clients/${clientId}/secrets.sops.yaml`);
    if (!fs.existsSync(secretsPath)) {
      throw new Error(`Client secrets.sops.yaml not found: ${clientId}`);
    }
    
    console.log(`🔐 Decrypting secrets for: ${clientId}`);
    
    const sopsPath = getSopsPath(envsRepoPath);
    console.log(`🔧 Using SOPS: ${sopsPath}`);
    
    // ✅ USAR ASYNC SPAWN en lugar de execSync
    const decryptOutput = await decryptSopsAsync(sopsPath, secretsPath, gpgPassphrase);
    
    const secretsConfig = JSON.parse(decryptOutput);
    console.log('✅ Secrets decrypted successfully');
    
    // 3. Merge configs
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
      
      // URLs
      coreApiHost: yamlConfig.coreApiHost ?? '',
      servicesPort: yamlConfig.servicesPort ?? '',
      authUrl: yamlConfig.authUrl ?? '',
      backendUrl: yamlConfig.backendUrl ?? '',
      apiUrl: `${yamlConfig.coreApiHost}:${yamlConfig.servicesPort}${yamlConfig.backendUrl}`,
      authFullUrl: `${yamlConfig.coreApiHost}:${yamlConfig.servicesPort}${yamlConfig.authUrl}`,
      
      // Certificates
      certPdfSignType: yamlConfig.certPdfSignType ?? 'p12',
      certPdfSignPath: secretsConfig.cert_pdf_sign_path ?? yamlConfig.certPdfSignPath ?? '',
      certPdfSignPassword: secretsConfig.cert_pdf_sign_password ?? yamlConfig.certPdfSignPassword ?? '',
      
      // Metadata
      standalone_mode: true,
      config_source: 'SOPS_STANDALONE'
    };
    
    console.log('✅ Config loaded successfully in standalone mode');
    
    return mergedConfig;
    
  } catch (error) {
    console.error('❌ Standalone config loading failed:', (error as Error).message);
    throw error;
  }
};

/**
 * Load config in traditional mode (.env + YAML)
 */
const loadTraditionalConfig = () => {
  console.log('🔧 Loading config via .env + YAML (Traditional Mode)');
  
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = envContent
      .split('\n')
      .filter(line => line.includes('=') && !line.startsWith('#'))
      .reduce((acc, line) => {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        acc[key.trim()] = value.replace(/^["']|["']$/g, '');
        return acc;
      }, {} as Record<string, string>);
    
    Object.assign(process.env, envVars);
    console.log(`✅ Loaded .env from: ${envPath}`);
  } else {
    console.warn(`⚠️ .env not found at: ${envPath}`);
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
    
    console.log(`✅ Loaded config.yaml from: ${yamlPath}`);
  } catch (err) {
    console.warn(`⚠️ Failed to load config.yaml:`, err);
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
  const useStandalone = shouldUseStandalone();
  
  if (useStandalone) {
    return await loadStandaloneConfig();
  } else {
    return loadTraditionalConfig();
  }
};

// Exports
export const getConfig = loadConfig;
export const getConfigAsync = loadConfig;
export default null;