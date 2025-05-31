import dotenv from 'dotenv';
dotenv.config();


// src/config/envConfig.ts
// Importing environment variables and setting up configuration for the application
// This file is responsible for loading environment variables and constructing the configuration object

const coreApiHost = process.env.CORE_API_HOST;
const backendPort = process.env.BACKEND_PORT;

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
  authUsername: process.env.AUTH_USERNAME,
  authPassword: process.env.AUTH_PASSWORD,
  authUrl: `${coreApiHost}:${backendPort}${process.env.AUTH_URL}`, // URL for the authentication service
  apiUrl: `${coreApiHost}:${backendPort}${process.env.BACKEND_URL}`, // Base URL for the API 
};

export default envConfig;


