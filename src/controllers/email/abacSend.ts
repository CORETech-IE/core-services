// src/controllers/email/abacSend.ts

import { Request, Response, NextFunction } from 'express';
import { enforceEmailPolicy } from '../../services/pep';
import { EmailParams } from '../../services/email/emailService';
import { sendEmailWithConfig } from '../../services/email/emailServiceHelpers';
import { signPDFAttachments, getSignedAttachments, validateSigningResults } from '../../services/email/pdfSigningService';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { ISO27001Classification, getSecurityControls } from '../../types/iso27001';

/**
 * ISO 27001 Compliant ABAC Email Send Controller
 * 
 * This controller implements Zero Trust architecture with ISO 27001 compliance:
 * - A.8.2.1: Information classification handling
 * - A.9.4.1: Information access restriction
 * - A.12.4.1: Event logging and audit trail
 * - A.13.2.1: Information transfer policies
 * - A.13.2.3: Electronic messaging with digital signatures
 * 
 * Security Flow based on ISO classification:
 * - internal: Single GDPR validation
 * - confidential: Double GDPR validation
 * - restricted: Double validation + digital PDF signing
 * 
 * Zero Trust Principle: Don't trust the caller, don't trust yourself.
 */
export const abacSend = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const trace_id = uuidv4();
  const gdpr_token = req.headers['gdpr-token'] || req.body?.gdpr_token;
  const classification: ISO27001Classification = req.body?.classification || 'restricted';

  logger.info('ISO 27001 compliant ABAC email process started', {
    trace_id,
    step: 'PROCESS_START',
    classification,
    has_gdpr_token: !!gdpr_token,
    iso_control: 'A.8.2.1' // Information classification
  });

  // Validate GDPR token presence (A.9.4.1 - Information access restriction)
  if (typeof gdpr_token !== 'string') {
    logger.warn('Missing or invalid gdpr_token', { 
      trace_id,
      step: 'GDPR_TOKEN_VALIDATION_FAILED',
      iso_control: 'A.9.4.1'
    });
    
    return res.status(400).json({
      trace_id,
      error: 'Missing or invalid gdpr_token',
      iso_control: 'A.9.4.1'
    });
  }

  // Get ISO 27001 security controls for this classification level
  const securityControls = getSecurityControls(classification);

  logger.info('ISO 27001 security controls determined', {
    trace_id,
    classification,
    security_controls: securityControls,
    iso_control: 'A.8.2.1'
  });

  try {
    // STEP 1: First GDPR validation (A.9.4.1 - Information access restriction)
    logger.info('Starting first GDPR validation', { 
      trace_id, 
      step: 'FIRST_VALIDATION_START',
      iso_control: 'A.9.4.1'
    });
    
    const firstValidation = enforceEmailPolicy(req.body, gdpr_token);
    
    if (!firstValidation.allowed) {
      logger.warn('First validation failed - Original payload rejected', {
        trace_id,
        step: 'FIRST_VALIDATION_FAILED',
        reason: firstValidation.reason,
        hash: firstValidation.hash,
        iso_control: 'A.9.4.1'
      });

      return res.status(403).json({
        trace_id,
        error: 'Email not allowed by policy (first validation)',
        reason: firstValidation.reason,
        iso_control: 'A.9.4.1'
      });
    }

    logger.info('First validation passed - Original payload approved', { 
      trace_id, 
      step: 'FIRST_VALIDATION_SUCCESS',
      hash: firstValidation.hash,
      iso_control: 'A.9.4.1'
    });

    let finalPayload = req.body;
    let secondValidation = firstValidation; // Default for 'internal' classification

    // STEP 2: PDF Signing and Double Validation (based on ISO classification)
    if (securityControls.electronicMessaging) {
      // A.13.2.3 - Electronic messaging: Digital signatures required for 'restricted'
      logger.info('Starting PDF signing process for restricted classification', { 
        trace_id, 
        step: 'PDF_SIGNING_START',
        attachment_count: req.body.attachments?.length || 0,
        iso_control: 'A.13.2.3'
      });
      
      finalPayload = await createPayloadWithSignedPDFs(req.body, trace_id);

      logger.info('PDF signing completed', { 
        trace_id, 
        step: 'PDF_SIGNING_SUCCESS',
        signed_attachment_count: finalPayload.attachments?.length || 0,
        iso_control: 'A.13.2.3'
      });
    }

    if (securityControls.informationTransfer) {
      // A.13.2.1 - Information transfer: Double validation for 'confidential' and 'restricted'
      logger.info('Starting second GDPR validation for enhanced security', { 
        trace_id, 
        step: 'SECOND_VALIDATION_START',
        iso_control: 'A.13.2.1'
      });
      
      secondValidation = enforceEmailPolicy(finalPayload, gdpr_token);
      
      if (!secondValidation.allowed) {
        logger.error('Second validation failed - Enhanced payload rejected', {
          trace_id,
          step: 'SECOND_VALIDATION_FAILED',
          reason: secondValidation.reason,
          hash: secondValidation.hash,
          original_hash: firstValidation.hash,
          iso_control: 'A.13.2.1'
        });

        return res.status(403).json({
          trace_id,
          error: 'Email not allowed by policy (second validation)',
          reason: secondValidation.reason,
          details: 'Enhanced payload differs from consented content',
          iso_control: 'A.13.2.1'
        });
      }

      logger.info('Second validation passed - Enhanced payload approved', { 
        trace_id, 
        step: 'SECOND_VALIDATION_SUCCESS',
        hash: secondValidation.hash,
        iso_control: 'A.13.2.1'
      });
    }

    // STEP 3: Send Email with ISO classification (A.12.4.1 - Event logging)
    logger.info('Starting ISO 27001 compliant email send', { 
      trace_id, 
      step: 'EMAIL_SEND_START',
      classification,
      iso_control: 'A.12.4.1'
    });
    
    // Add classification to payload for email service
    const emailPayload: EmailParams = {
      ...finalPayload,
      classification
    };
    
    // Use the clean DI helper function
    const emailStatus = await sendEmailWithConfig(emailPayload, trace_id);

    // A.12.4.1 - Event logging: Complete audit trail
    logger.info('ISO 27001 compliant email sent successfully', {
      trace_id,
      step: 'EMAIL_SEND_SUCCESS',
      user_id: process.env.TENANT_CLIENT_ID,
      gdpr_token,
      classification,
      security_controls: securityControls,
      first_hash: firstValidation.hash,
      second_hash: secondValidation.hash,
      email_status: emailStatus,
      status: 'DELIVERED',
      iso_controls: ['A.8.2.1', 'A.9.4.1', 'A.12.4.1', 'A.13.2.1']
    });

    res.status(200).json({
      trace_id,
      message: 'Email sent with ISO 27001 compliance',
      status: 'success',
      classification,
      security_controls: securityControls,
      validations: {
        first_hash: firstValidation.hash,
        second_hash: secondValidation.hash,
        both_passed: true,
        double_validation_applied: securityControls.informationTransfer
      },
      email_status: emailStatus,
      iso_controls: ['A.8.2.1', 'A.9.4.1', 'A.12.4.1', 'A.13.2.1']
    });

  } catch (err) {
    // A.12.4.1 - Event logging: Critical error logging
    logger.error('Critical error in ISO 27001 compliant ABAC email process', {
      trace_id,
      step: 'CRITICAL_ERROR',
      classification,
      error: (err as Error).message,
      stack: (err as Error).stack,
      iso_control: 'A.12.4.1'
    });

    console.error('💥 ISO 27001 ABAC Send critical error:', err);

    res.status(500).json({
      trace_id,
      error: 'Failed to send email due to internal error',
      details: 'Check logs for detailed error information',
      iso_control: 'A.12.4.1'
    });
  }
};

/**
 * Creates a new email payload with all PDF attachments digitally signed
 * 
 * This function implements ISO 27001 A.13.2.3 (Electronic messaging)
 * by applying digital signatures to PDF documents for data integrity
 * and authenticity verification.
 * 
 * @param originalPayload - Original email payload from PLSQL call
 * @param trace_id - Trace ID for logging and audit trail (A.12.4.1)
 * @returns New payload with signed PDF attachment paths
 * @throws Error if PDF signing fails (fail-fast for security)
 */
async function createPayloadWithSignedPDFs(
  originalPayload: EmailParams, 
  trace_id: string
): Promise<EmailParams> {
  
  // If no attachments, return original payload unchanged
  if (!originalPayload.attachments || originalPayload.attachments.length === 0) {
    logger.info('No attachments to process for digital signing', { 
      trace_id,
      step: 'NO_ATTACHMENTS',
      iso_control: 'A.13.2.3'
    });
    return originalPayload;
  }

  logger.info('Processing attachments for ISO 27001 compliant PDF signing', {
    trace_id,
    step: 'PROCESSING_ATTACHMENTS',
    original_attachment_count: originalPayload.attachments.length,
    iso_control: 'A.13.2.3'
  });

  // Sign all PDF attachments using the dedicated PDF signing service
  const signingResults = await signPDFAttachments(originalPayload.attachments, trace_id);
  
  // Validate that all expected PDFs were signed successfully (A.13.2.3)
  // This will throw an error if any PDF that should have been signed wasn't
  validateSigningResults(signingResults, trace_id);
  
  // Extract the final list of attachments (signed PDFs + unchanged non-PDFs)
  const finalAttachments = getSignedAttachments(signingResults);

  logger.info('ISO 27001 PDF signing validation completed', {
    trace_id,
    step: 'SIGNING_VALIDATION_SUCCESS',
    original_count: originalPayload.attachments.length,
    final_count: finalAttachments.length,
    signed_pdfs: signingResults.filter(r => r.wasSigned).length,
    iso_control: 'A.13.2.3'
  });

  // Return new payload with signed attachment paths
  // This will generate a different hash than the original payload for second validation
  return {
    ...originalPayload,
    attachments: finalAttachments
  };
}