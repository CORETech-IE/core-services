import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import dotenv from 'dotenv';

// Load environment variables from .env if available
//dotenv.config();
dotenv.config({ path: path.resolve(__dirname, './.env') });

// Get client ID from CLI argument
const clientId = process.argv[2];
if (!clientId) {
  console.error('❌ Missing CLIENT_ID. Usage: npm run dev -- core-dev');
  process.exit(1);
}

// Resolve path to config.yaml (shared repo)
const envsPath = path.resolve(__dirname, '../../../core-envs-private/clients', clientId);
const configPath = path.join(envsPath, 'config.yaml');

let clientConfig: any = {};

try {
  const fileContents = fs.readFileSync(configPath, 'utf8');
  clientConfig = yaml.load(fileContents);
} catch (error) {
  console.error(`❌ Failed to load config for client "${clientId}" from ${configPath}`);
  console.error(error);
  process.exit(1);
}

export const config = {
  pdf: {
    templatePath: path.resolve(__dirname, '../../../reports_templates/templates'),
    cssPath: path.resolve(__dirname, '../../../reports_templates/css')
  },
  zpl: {
    templatePath: path.resolve(__dirname, '../../../reports_templates/templates')
  },
  email: {
    smtpHost: clientConfig.smtp?.host || 'localhost',
    smtpPort: clientConfig.smtp?.port || 587,
    smtpUser: clientConfig.smtp?.user || '',
    smtpPass: clientConfig.smtp?.pass || ''
  },
  auth: {
    authUrl: process.env.AUTH_URL || 'http://localhost:3000/auth/login',
    apiUrl: process.env.API_URL || 'http://localhost:3000/api',
    username: process.env.AUTH_USERNAME,
    password: process.env.AUTH_PASSWORD
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || '',
    internalJwtSecret: process.env.INTERNAL_JWT_SECRET || ''
  },
  oauth: {
    senderEmail: process.env.SENDER_EMAIL || '',
    clientId: process.env.CLIENT_ID || '',
    clientSecret: process.env.CLIENT_SECRET || '',
    tenantId: process.env.TENANT_ID || '',
    refreshToken: process.env.REFRESH_TOKEN || '',
    tenantClientId: process.env.TENANT_CLIENT_ID || '',
    tokenEndpoint: process.env.TOKEN_ENDPOINT || 'https://login.microsoftonline.com'
  },
  cert: {
    certPdfSignType: process.env.CERT_PDF_SIGN_TYPE || 'p12', 
    certPdfSignPassword: process.env.CERT_PDF_SIGN_PASSWORD, 
    certPdfSignPath: process.env.CERT_PDF_SIGN_PATH , 
  },
  client: clientId,
  raw: clientConfig
};
