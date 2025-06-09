// services/pdp-production.ts

import { getGDPRService, GDPRValidationRequest } from './gdpr/gdprTokenService';
import logger from '../utils/logging';

/**
 * Production PDP (Policy Decision Point) service
 * Replaces the mock implementation with real GDPR token validation
 */

export type PDPAttributes = {
  gdpr_token: string;
  payload_hash: string;
  purpose?: string;
  subject?: string;
  user_id?: string;
};

export type PDPDecision = {
  allow: boolean;
  reason: string;
  hash_type?: 'original' | 'signed';
};

/**
 * Evaluates GDPR consent policy using the production GDPR service
 * 
 * @param attributes - Policy attributes to validate
 * @returns Policy decision with detailed reasoning
 */
export const evaluatePolicy = (attributes: PDPAttributes): PDPDecision => {
  const gdprService = getGDPRService();
  
  logger.system('Evaluating GDPR policy', {
    token_preview: attributes.gdpr_token?.substring(0, 8) + '...',
    payload_hash: attributes.payload_hash?.substring(0, 16) + '...',
    subject: attributes.subject,
    purpose: attributes.purpose
  });
  
  // Validate required fields
  if (!attributes.gdpr_token) {
    return {
      allow: false,
      reason: 'Missing GDPR token'
    };
  }
  
  if (!attributes.payload_hash) {
    return {
      allow: false,
      reason: 'Missing payload hash'
    };
  }
  
  if (!attributes.subject) {
    return {
      allow: false,
      reason: 'Missing subject email'
    };
  }
  
  // Validate with GDPR service
  const validationRequest: GDPRValidationRequest = {
    token: attributes.gdpr_token,
    payload_hash: attributes.payload_hash,
    recipient_email: attributes.subject,
    purpose: attributes.purpose
  };
  
  const result = gdprService.validateToken(validationRequest);
  
  logger.system('GDPR policy evaluation completed', {
    token_preview: attributes.gdpr_token.substring(0, 8) + '...',
    validation_result: result.valid,
    reason: result.reason,
    hash_type: result.hash_type
  });
  
  return {
    allow: result.valid,
    reason: result.reason,
    hash_type: result.hash_type
  };
};