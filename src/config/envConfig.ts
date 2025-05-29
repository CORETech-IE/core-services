import dotenv from 'dotenv';
dotenv.config();

const envConfig = {
  senderEmail: process.env.SENDER_EMAIL || '',
  clientId: process.env.CLIENT_ID || '',
  clientSecret: process.env.CLIENT_SECRET || '',
  tenantId: process.env.TENANT_ID || '',
  refreshToken: process.env.REFRESH_TOKEN || '',
  tenantClientId: process.env.TENANT_CLIENT_ID || '',
  tokenEndpoint: 'https://login.microsoftonline.com', 
  jwtSecret: process.env.JWT_SECRET || '',
  internalJwtSecret: process.env.INTERNAL_JWT_SECRET || '',
  pg: {
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || '',
    user: process.env.PGUSER || '',
    password: process.env.PGPASSWORD || '',
    port: Number(process.env.PGPORT) || 5432
  },
  logApiKey: process.env.LOG_API_KEY || ''
};

export default envConfig;
