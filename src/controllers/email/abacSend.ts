// src/controllers/email/abacSend.ts

import { Request, Response, NextFunction } from 'express';
import { enforceEmailPolicy } from '../../services/pep';
import { sendEmail } from '../../services/email/emailService';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export const abacSend = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const trace_id = uuidv4();
  const gdpr_token = req.headers['gdpr-token'] || req.body?.gdpr_token;

  if (typeof gdpr_token !== 'string') {
    logger.warn('Missing or invalid gdpr_token', { trace_id });
    return res.status(400).json({
      trace_id,
      error: 'Missing or invalid gdpr_token'
    });
  }

  // 1. Validar payload + PDP decision
  const result = enforceEmailPolicy(req.body, gdpr_token);

  if (!result.allowed) {
    logger.warn('Email blocked by policy', {
      trace_id,
      user_id: process.env.TENANT_CLIENT_ID,
      reason: result.reason,
      hash: result.hash
    });

    return res.status(403).json({
      trace_id,
      error: 'Email not allowed by policy',
      reason: result.reason
    });
  }

  try {
    // 2. Enviar email
    await sendEmail(req.body, trace_id);

    logger.info('Email sent successfully', {
      trace_id,
      user_id: process.env.TENANT_CLIENT_ID,
      gdpr_token,
      hash: result.hash,
      status: 'DELIVERED'
    });

    res.status(200).json({
      trace_id,
      message: 'Email sent'
    });
  } catch (err) {
    logger.error('Error sending email', {
      trace_id,
      error: (err as Error).message
    });

    console.error('💥 Send email error:', err);

    res.status(500).json({
      trace_id,
      error: 'Failed to send email'
    });
  }
};
