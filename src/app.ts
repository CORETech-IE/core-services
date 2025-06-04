import express from 'express';
import helmet from 'helmet';
import { getConfigAsync } from './config/envConfig';
import { validateConfig } from './config/config-validator';
import { initServiceContainer } from './services/serviceContainer';
import { createAuthenticateJWT } from './middlewares/authenticateJWT';
import { authorizeAdmin } from './middlewares';  // ← NUEVA LÍNEA 1
import authRoutes from './routes/authRoutes';
import emailPublicRoutes from './services/email/publicRoutes';  // ← NUEVA LÍNEA 2

const startApp = async () => {
  const config = await getConfigAsync();
  console.log('🚀 Config loaded!');
  
  validateConfig(config);
  console.log('✅ Config validated!');
 
  initServiceContainer(config);
  console.log('🏗️ Service container initialized');
  
  // Create JWT middleware with loaded config
  const authenticateJWT = createAuthenticateJWT(config.jwtSecret);
  console.log('🔐 JWT middleware created');
 
  const app = express();
  app.use(helmet());
  app.use(express.json());
  
  // Auth routes - para poder hacer login
  app.use('/auth', authRoutes);
  
  // EMAIL ROUTES - ¡EL MOMENTO DE LA VERDAD!
  app.use('/api/email', authenticateJWT, authorizeAdmin, emailPublicRoutes);  // ← NUEVA LÍNEA 3
 
  app.get('/health', (_, res) => {
    res.status(200).send('OK');
  });
 
  console.log('📝 About to start express server...');

  const PORT = config.servicesPort || 3001;
  app.listen(PORT, () => {
    console.log(`[core-services] API listening on port ${PORT}`);
    console.log('[core-services] 🚀 FULL EMAIL FUNCTIONALITY RESTORED!');
    console.log('[core-services] Ready for ISO 27001 compliant emails!');
  });
};

console.log('🔄 Listen called, waiting for server...');

startApp().catch(console.error);