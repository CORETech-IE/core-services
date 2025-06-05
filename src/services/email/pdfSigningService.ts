// src/services/pdfSigningService.ts

import { signPDF } from '../../utils/pdfSigner';
import logger from '../../utils/logging';
import { getServiceContainer } from '../serviceContainer';
import { EmailAttachment } from '../email/emailService';
import { PdfSigningConfig } from '../../types/pdfTypes';

/**
 * PDF Signing Service
 * 
 * Single responsibility: Sign PDF files and return updated attachment paths.
 * This service doesn't know about emails, GDPR, or anything else.
 * It just signs PDFs and tells you where the signed versions are.
 */

export interface SigningResult {
  originalAttachment: EmailAttachment;
  signedAttachment: EmailAttachment;
  wasSigned: boolean;
  reason: string;
}

/**
 * Signs all PDF attachments in the provided list
 * 
 * For each attachment:
 * - If it's not a PDF: returns original unchanged
 * - If it's already signed: returns original unchanged  
 * - If it's a PDF that needs signing: signs it and returns new path
 * 
 * @param attachments - Array of original attachments
 * @param trace_id - Trace ID for logging context
 * @returns Array of signing results with original and signed attachment info
 */
export async function signPDFAttachments(
  attachments: EmailAttachment[],
  trace_id: string
): Promise<SigningResult[]> {
  
  if (!attachments || attachments.length === 0) {
    logger.info('No attachments provided for signing', { trace_id });
    return [];
  }

  const results: SigningResult[] = [];

  for (const attachment of attachments) {
    const result = await signSingleAttachment(attachment, trace_id);
    results.push(result);
  }

  logger.info('PDF signing batch completed', {
    trace_id,
    total_attachments: attachments.length,
    signed_count: results.filter(r => r.wasSigned).length,
    skipped_count: results.filter(r => !r.wasSigned).length
  });

  return results;
}

/**
 * Signs a single attachment if it's a PDF that needs signing
 * 
 * Business rules:
 * - Non-PDF files: skip (return original)
 * - Already signed PDFs: skip (return original)
 * - Unsigned PDFs: sign and return new path
 * 
 * @param attachment - Single attachment to process
 * @param trace_id - Trace ID for logging
 * @returns Signing result with original and signed attachment info
 */
async function signSingleAttachment(
  attachment: EmailAttachment,
  trace_id: string
): Promise<SigningResult> {
  
  // Skip non-PDF files
  if (!attachment.name.toLowerCase().endsWith('.pdf')) {
    logger.info('Skipping non-PDF attachment', {
      trace_id,
      name: attachment.name,
      reason: 'Not a PDF file'
    });
    
    return {
      originalAttachment: attachment,
      signedAttachment: attachment, // Same as original
      wasSigned: false,
      reason: 'Not a PDF file'
    };
  }

  // Skip already signed PDFs
  if (attachment.name.endsWith('_signed.pdf')) {
    logger.info('Skipping already signed PDF', {
      trace_id,
      name: attachment.name,
      reason: 'Already signed'
    });
    
    return {
      originalAttachment: attachment,
      signedAttachment: attachment, // Same as original
      wasSigned: false,
      reason: 'Already signed'
    };
  }

  // Sign the PDF
  const signedName = attachment.name.replace(/\.pdf$/i, '_signed.pdf');
  const signedPath = attachment.path.replace(/\.pdf$/i, '_signed.pdf');

  logger.info('Signing PDF attachment', {
    trace_id,
    original_name: attachment.name,
    original_path: attachment.path,
    signed_name: signedName,
    signed_path: signedPath
  });

  try {
    // Get PDF signing config from service container
    const container = getServiceContainer();
    const pdfConfig = container.getPdfSigningConfig();

    await signPDF({
      pdfPath: attachment.path,
      outputPath: signedPath,
      certPath: pdfConfig.certPdfSignPath,
      certPassword: pdfConfig.certPdfSignPassword || '',
      type: pdfConfig.certPdfSignType
    });

    logger.info('PDF signing successful', {
      trace_id,
      original_name: attachment.name,
      signed_name: signedName
    });

    return {
      originalAttachment: attachment,
      signedAttachment: {
        name: signedName,
        path: signedPath
      },
      wasSigned: true,
      reason: 'Successfully signed'
    };

  } catch (error) {
    logger.error('PDF signing failed', {
      trace_id,
      original_name: attachment.name,
      error: (error as Error).message
    });

    // In case of signing failure, we could either:
    // 1. Throw error (fail fast)
    // 2. Return original (fallback)
    // For security, we choose fail fast
    throw new Error(`Failed to sign PDF ${attachment.name}: ${(error as Error).message}`);
  }
}

/**
 * Extracts only the signed attachments from signing results
 * 
 * This is a convenience function for callers who just want
 * the final list of attachments to use for email sending.
 * 
 * @param signingResults - Results from signPDFAttachments()
 * @returns Array of attachments ready for email sending
 */
export function getSignedAttachments(signingResults: SigningResult[]): EmailAttachment[] {
  return signingResults.map(result => result.signedAttachment);
}

/**
 * Validates that all expected PDFs were successfully signed
 * 
 * Use this to ensure no unsigned PDFs slip through the process.
 * Throws error if any PDF that should have been signed wasn't.
 * 
 * @param signingResults - Results from signPDFAttachments()
 * @param trace_id - Trace ID for logging
 * @throws Error if validation fails
 */
export function validateSigningResults(
  signingResults: SigningResult[],
  trace_id: string
): void {
  
  const pdfFiles = signingResults.filter(r => 
    r.originalAttachment.name.toLowerCase().endsWith('.pdf')
  );
  
  const unsignedPdfs = pdfFiles.filter(r => 
    !r.wasSigned && !r.originalAttachment.name.endsWith('_signed.pdf')
  );

  if (unsignedPdfs.length > 0) {
    const unsignedNames = unsignedPdfs.map(r => r.originalAttachment.name);
    
    logger.error('Validation failed: unsigned PDFs detected', {
      trace_id,
      unsigned_pdfs: unsignedNames
    });
    
    throw new Error(`Unsigned PDFs detected: ${unsignedNames.join(', ')}`);
  }

  logger.info('PDF signing validation passed', {
    trace_id,
    total_pdfs: pdfFiles.length,
    all_signed: true
  });
}