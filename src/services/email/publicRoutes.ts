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
        from: req.body.from || 'config_default',
        subject: req.body.subject?.substring(0, 50),
        from_oracle: true,
        endpoint: 'send-internal',
        bypass_pep: true
      });

      // Llamar directamente a sendEmail SIN PEP
      const container = getServiceContainer();
      const emailConfig = container.getEmailConfig();
      
      const result = await sendEmail(req.body, trace_id, emailConfig);
     
      logger.info('Internal email sent successfully - BYPASS MODE', {
        trace_id,
        result,
        to: req.body.to,
        from: req.body.from || 'config_default',
        bypass_pep: true
      });
 
      res.json({
        success: true,
        trace_id,
        result,
        message: 'Email sent successfully from internal endpoint (bypass mode)'
      });
     
    } catch (err: any) {
      // 🔥 MEJORAR ERRORES COMO EN EL ENDPOINT GDPR
      const error = err as any;
      
      logger.error('Internal email failed', {
        trace_id,
        error: error.message,
        to: req.body.to,
        from: req.body.from || 'config_default',
        bypass_mode: true,
        has_error_details: !!error.details,
        has_user_action: !!error.userAction
      });

      // Si el error viene del emailService mejorado, usar esos detalles
      if (error.details && error.userAction) {
        return res.status(error.statusCode === 403 ? 403 : 500).json({
          success: false,
          trace_id,
          error: error.message,
          details: error.details,
          user_action: error.userAction,
          ...(error.graphErrorCode && { graph_error_code: error.graphErrorCode }),
          endpoint: 'send-internal',
          timestamp: new Date().toISOString()
        });
      } else {
        // Error genérico
        return res.status(500).json({
          success: false,
          trace_id,
          error: error.message || 'Unknown error',
          details: 'An unexpected error occurred in internal email endpoint',
          user_action: 'Check the email parameters and try again',
          endpoint: 'send-internal',
          timestamp: new Date().toISOString()
        });
      }
    }
}); 

export default router;