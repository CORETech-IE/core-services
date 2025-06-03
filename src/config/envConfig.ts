import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import yaml from 'js-yaml';

// Load .env from src/.env
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✅ Loaded .env from: ${envPath}`);
} else {
  console.warn(`⚠️ .env not found at: ${envPath}`);
}

// Load config.yaml from core-envs-private
const yamlPath = path.resolve(__dirname, '../../../core-envs-private/clients/core-dev/config.yaml');
let yamlConfig: Record<string, any> = {};

try {
  const file = fs.readFileSync(yamlPath, 'utf8');
  const parsed = yaml.load(file) as Record<string, any>;

  // Convert keys from snake_case to camelCase
  yamlConfig = Object.entries(parsed).reduce((acc, [key, value]) => {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    acc[camelKey] = value;
    return acc;
  }, {} as Record<string, any>);

  console.log(`✅ Loaded config.yaml from: ${yamlPath}`);
} catch (err) {
  console.warn(`⚠️ Failed to load config.yaml at ${yamlPath}:`, err);
}

// Merge with .env variables (they override YAML values if present)
const envConfig = {
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

  // 👇 Añade explícitamente las que necesites tipadas
  coreApiHost: yamlConfig.coreApiHost ?? '',
  servicesPort: yamlConfig.servicesPort ?? '',
  authUrl: yamlConfig.authUrl ?? '',
  backendUrl: yamlConfig.backendUrl ?? '',
  apiUrl: `${yamlConfig.coreApiHost}:${yamlConfig.servicesPort}${yamlConfig.backendUrl}`,
  authFullUrl: `${yamlConfig.coreApiHost}:${yamlConfig.servicesPort}${yamlConfig.authUrl}`,
  certPdfSignType: yamlConfig.certPdfSignType ?? 'p12', // Default to 'p12' if not specified
  certPdfSignPath: process.env.cert_pdf_sign_HASHpath ?? yamlConfig.certPdfSignPath ?? '',
  certPdfSignPassword: process.env.cert_pdf_sign_password ?? yamlConfig.certPdfSignPassword ?? '',
};


export default envConfig;
