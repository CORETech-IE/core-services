import express from 'express';
import helmet from 'helmet';
import path from 'path';
import {
  authenticateJWT,
  allowGetPostOnly,
  rateLimiter,
  securityHeaders,
  authorizeAdmin,
  errorHandler,
} from './middlewares';

import pdfRoutes from './services/pdf/routes';
import zplRoutes from './services/zpl/routes';
import emailInternalRoutes from './services/email/internalRoutes';
import emailPublicRoutes from './services/email/publicRoutes';
import authRoutes from './routes/authRoutes';
import { initializeBrowserPool } from './config/browserPool';
import { validateConfig } from './config/config-validator';
import envConfig from './config/envConfig';

// Validate configuration before starting the server
// This ensures all required environment variables are set
// and the application is ready to run
validateConfig();

// Initialize the browser pool for Puppeteer
// This is necessary to ensure that the browser instances are ready for use
// before any requests are handled.
(async () => {
  await initializeBrowserPool(); 
})();

const app = express();

console.log('Environment Variables Loaded:');
console.log(`servicesPort: ${envConfig.servicesPort}`);
const PORT = envConfig.servicesPort;


app.use('/img', express.static(path.resolve(__dirname, '../../reports_templates/img')));

// Middleware
app.use(helmet());
app.use(express.json());
app.use(allowGetPostOnly);
app.use(rateLimiter);
app.use(securityHeaders);

app.use('/auth', authRoutes);
// Services
// PDF, ZPL, Email
app.use('/pdf', authenticateJWT, authorizeAdmin, pdfRoutes);
app.use('/zpl', authenticateJWT, authorizeAdmin, zplRoutes);
app.use('/email', emailInternalRoutes);

// Public Email Routes
app.use('/api/email', emailPublicRoutes);

// test
app.get('/health', (_, res) => {
  res.status(200).send('OK');
});

// Error global
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[core-services] API listening on port ${PORT}`);
});