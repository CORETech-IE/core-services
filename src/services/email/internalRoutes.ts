import express from 'express';
import { sendEmailWithConfig } from './emailServiceHelpers';
import { createAuthenticateJWT, authorizeAdmin } from '../../middlewares';
import { getServiceContainer } from '../serviceContainer';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

router.post(
  '/send-internal',
  // Dynamic middleware - creates JWT authenticator with loaded config
  (req, res, next) => {
    try {
      const container = getServiceContainer();
      const jwtSecret = container.getJwtSecret();
      const authenticateJWT = createAuthenticateJWT(jwtSecret);
      authenticateJWT(req, res, next);
    } catch (error) {
      res.status(500).json({ 
        error: 'Service not properly initialized',
        details: (error as Error).message 
      });
    }
  },
  authorizeAdmin,
  async (req, res) => {
    const trace_id = uuidv4(); // Generate a unique trace ID for this request
    
    try {
      const result = await sendEmailWithConfig(req.body, trace_id);
      res.json({ success: true, trace_id, result });
    } catch (err) {
      res.status(500).json({ error: 'Failed to send email', trace_id });
    }
  }
);

export default router;