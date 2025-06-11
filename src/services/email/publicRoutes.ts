// src/services/email/publicRoutes.ts
import express from 'express';
import { abacSend } from '../../controllers/email/abacSend';
import { getServiceContainer } from '../serviceContainer';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logging';
import { sendEmail } from './emailService';

const router = express.Router();

// No requiere JWT, solo gdpr_token
router.post('/send-with-consent', abacSend);

router.post('/send-internal', async (req, res) => {
    const trace_id = uuidv4();
   
    try {
      logger.info('Internal email request received - BYPASS MODE', {
        trace_id,
        to: req.body.to,
        subject: req.body.subject?.substring(0, 50),
        from_oracle: true,
        endpoint: 'send-internal',
        bypass_pep: true
      });

      // ✅ Llamar directamente a sendEmail SIN PEP
      const container = getServiceContainer();
      const emailConfig = container.getEmailConfig();
      
      // Enviar email directamente - NO sendEmailWithConfig
      const result = await sendEmail(req.body, trace_id, emailConfig);
     
      logger.info('Internal email sent successfully - BYPASS MODE', {
        trace_id,
        result,
        to: req.body.to,
        bypass_pep: true
      });
 
      res.json({
        success: true,
        trace_id,
        result,
        message: 'Email sent successfully from internal endpoint (bypass mode)'
      });
     
    } catch (err) {
      logger.error('Internal email failed', {
        trace_id,
        error: (err as Error).message,
        to: req.body.to,
        bypass_mode: true
      });
 
      res.status(500).json({
        success: false,
        trace_id,
        error: (err as Error).message,
        endpoint: 'send-internal'
      });
    }
}); 

export default router;