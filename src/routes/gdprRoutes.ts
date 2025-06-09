// routes/gdprRoutes.ts

import express from 'express';
import { getGDPRService, GDPRTokenRequest } from '../services/gdpr/gdprTokenService';
import { generatePayloadHash } from '../utils/hashUtils';
import { z } from 'zod';
import logger from '../utils/logging';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * Schema for GDPR token generation request
 */
const GDPRTokenRequestSchema = z.object({
  recipient_email: z.string().email('Invalid email format'),
  purpose: z.string().min(1, 'Purpose is required').default('email_notification'),
  email_payload: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string(),
    classification: z.string().optional(),
    attachments: z.array(z.object({
      name: z.string(),
      path: z.string()
    })).optional()
  }),
  expires_in_hours: z.number().min(1).max(168).default(24), // Max 1 week
  user_id: z.string().optional(),
  client_id: z.string().optional()
});



/**
 * POST /gdpr/generate-token
 * Generate a new GDPR consent token for email sending
 */
router.post('/generate-token', async (req, res) => {
  const trace_id = uuidv4();
  
  try {
    logger.system('GDPR token generation requested', {
      trace_id,
      ip: req.ip,
      user_agent: req.get('User-Agent')
    });
    
    // Validate request
    const validation = GDPRTokenRequestSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('GDPR token generation failed - validation error', {
        trace_id,
        errors: validation.error.issues
      });
      
      return res.status(400).json({
        trace_id,
        error: 'Validation failed',
        details: validation.error.issues
      });
    }
    
    const { 
      recipient_email, 
      purpose, 
      email_payload, 
      expires_in_hours, 
      user_id, 
      client_id 
    } = validation.data;
    
    // Generate consistent hash of the email payload
    const payload_hash = generatePayloadHash(email_payload);
    
    logger.system('Generated payload hash for GDPR token', {
      trace_id,
      recipient_email,
      payload_hash: payload_hash.substring(0, 16) + '...',
      payload_keys: Object.keys(email_payload)
    });
    
    // Generate GDPR token
    const gdprService = getGDPRService();
    const tokenRequest: GDPRTokenRequest = {
      recipient_email,
      purpose,
      payload_hash,
      expires_in_hours,
      user_id,
      client_id
    };
    
    const consentRecord = gdprService.generateToken(tokenRequest);
    
    logger.system('GDPR token generated successfully', {
      trace_id,
      token_preview: consentRecord.token.substring(0, 8) + '...',
      recipient_email,
      expires_at: consentRecord.expires_at
    });
    
    // Return token and metadata
    res.status(200).json({
      trace_id,
      success: true,
      gdpr_token: consentRecord.token,
      payload_hash,
      expires_at: consentRecord.expires_at,
      recipient_email,
      purpose,
      message: 'GDPR consent token generated successfully'
    });
    
  } catch (error) {
    logger.error('GDPR token generation failed', {
      trace_id,
      error: (error as Error).message,
      stack: (error as Error).stack
    });
    
    res.status(500).json({
      trace_id,
      error: 'Failed to generate GDPR token',
      details: 'Internal server error'
    });
  }
});

/**
 * GET /gdpr/validate-token/:token
 * Validate a GDPR token (for debugging/testing)
 */
router.get('/validate-token/:token', async (req, res) => {
  const trace_id = uuidv4();
  const { token } = req.params;
  const { payload_hash, recipient_email, purpose } = req.query;
  
  try {
    if (!payload_hash || !recipient_email) {
      return res.status(400).json({
        trace_id,
        error: 'payload_hash and recipient_email query parameters are required'
      });
    }
    
    const gdprService = getGDPRService();
    const result = gdprService.validateToken({
      token,
      payload_hash: payload_hash as string,
      recipient_email: recipient_email as string,
      purpose: purpose as string
    });
    
    res.json({
      trace_id,
      valid: result.valid,
      reason: result.reason,
      hash_type: result.hash_type
    });
    
  } catch (error) {
    logger.error('GDPR token validation failed', {
      trace_id,
      error: (error as Error).message
    });
    
    res.status(500).json({
      trace_id,
      error: 'Failed to validate GDPR token'
    });
  }
});

/**
 * GET /gdpr/stats
 * Get GDPR service statistics
 */
router.get('/stats', async (req, res) => {
  const trace_id = uuidv4();
  
  try {
    const gdprService = getGDPRService();
    const stats = gdprService.getStats();
    
    res.json({
      trace_id,
      stats,
      message: 'GDPR service statistics'
    });
    
  } catch (error) {
    logger.error('Failed to get GDPR stats', {
      trace_id,
      error: (error as Error).message
    });
    
    res.status(500).json({
      trace_id,
      error: 'Failed to get statistics'
    });
  }
});

export default router;