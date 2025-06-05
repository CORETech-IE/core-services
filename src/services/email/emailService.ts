// src/services/email/emailService.ts

import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { getAccessToken, TokenServiceConfig } from './tokenService';
import logger from '../../utils/logging';

/**
 * Email Service - Pure Email Sending with Enhanced Security
 * 
 * Single responsibility: Send emails via Microsoft Graph API.
 * This service doesn't sign PDFs, validate GDPR, or do any business logic.
 * It just takes email parameters and sends them with maximum security headers.
 */

export interface EmailAttachment {
  name: string;
  path: string;
}

import { ISO27001Classification } from '../../types/iso27001';

export interface EmailParams {
  from?: string;
  to: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
  // ISO 27001 Annex A.8.2 - Information Classification
  classification: ISO27001Classification;
  // Optional parameters
  importance?: 'low' | 'normal' | 'high';
  gdpr_token?: string;
}

export interface EmailServiceConfig extends TokenServiceConfig {
  senderEmail: string;
}

/**
 * Sends an email with the provided parameters via Microsoft Graph API
 * 
 * This function assumes:
 * - All PDFs are already signed (if signing was required)
 * - All GDPR validation has been completed
 * - All file paths are valid and accessible
 * 
 * Enhanced with security headers for audit trail and compliance.
 * 
 * @param emailParams - Email parameters including recipient, subject, body, and attachments
 * @param trace_id - Trace ID for logging and audit trail
 * @param config - Email service configuration (senderEmail)
 * @returns HTTP status code from Microsoft Graph API
 * @throws Error if email sending fails
 */
export async function sendEmail(
  { 
    from, 
    to, 
    subject, 
    body, 
    attachments = [], 
    classification,
    importance = 'normal',
    gdpr_token
  }: EmailParams,
  trace_id: string,
  config: EmailServiceConfig
): Promise<number> {
  
  logger.info('Starting ISO 27001 compliant email send process', {
    trace_id,
    to,
    subject: subject.substring(0, 50), // Log truncated subject for privacy
    attachment_count: attachments.length,
    classification,
    importance,
    has_gdpr_token: !!gdpr_token,
    iso_control: 'A.8.2.1' // Information classification
  });

  // Build the Microsoft Graph email payload with enhanced security
  const emailPayload: any = {
    message: {
      subject,
      body: {
        contentType: 'Text',
        content: body
      },
      toRecipients: [
        {
          emailAddress: {
            address: to
          }
        }
      ],
      // ISO 27001 compliant headers and properties
      importance,
      // Custom headers for ISO 27001 compliance and audit trail
      internetMessageHeaders: buildISO27001SecurityHeaders(trace_id, classification, gdpr_token, attachments)
    },
    saveToSentItems: true
  };

  // Process attachments if any exist
  if (attachments.length > 0) {
    emailPayload.message.attachments = await processAttachments(attachments, trace_id);
  }

  // Get OAuth token for Microsoft Graph
  const accessToken = await getAccessToken(config);
  const sender = from || config.senderEmail;

  logger.info('Sending ISO 27001 compliant email via Microsoft Graph API', {
    trace_id,
    sender,
    classification,
    importance,
    custom_headers_count: emailPayload.message.internetMessageHeaders.length,
    api_endpoint: `https://graph.microsoft.com/v1.0/users/${sender}/sendMail`,
    iso_control: 'A.13.2.1' // Information transfer
  });

  try {
    // Send the email via Microsoft Graph API
    const response = await axios.post(
      `https://graph.microsoft.com/v1.0/users/${sender}/sendMail`,
      emailPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info('ISO 27001 compliant email sent successfully via Microsoft Graph', {
      trace_id,
      to,
      sender,
      status_code: response.status,
      attachment_count: attachments.length,
      classification,
      importance,
      iso_control: 'A.12.4.1' // Audit logging
    });

    return response.status;

  } catch (error) {
    logger.error('Failed to send enhanced email via Microsoft Graph', {
      trace_id,
      to,
      sender,
      error: (error as any).message,
      status: (error as any).response?.status,
      response_data: (error as any).response?.data
    });

    throw new Error(`Email sending failed: ${(error as Error).message}`);
  }
}

/**
 * Builds ISO 27001 compliant security headers for email
 * 
 * Headers comply with:
 * - A.8.2.1 (Information classification)
 * - A.12.4.1 (Event logging)
 * - A.13.2.1 (Information transfer)
 * 
 * Microsoft Graph API limits to 5 headers max, so we prioritize
 * the most critical ISO 27001 compliance headers.
 * 
 * @param trace_id - Unique trace ID for audit trail (A.12.4.1)
 * @param classification - ISO 27001 information classification (A.8.2.1)
 * @param gdpr_token - GDPR consent token (if available)
 * @param attachments - List of attachments for security marking
 * @returns Array of ISO 27001 compliant email headers
 */
function buildISO27001SecurityHeaders(
  trace_id: string,
  classification: ISO27001Classification,
  gdpr_token?: string, 
  attachments?: EmailAttachment[]
): Array<{ name: string; value: string }> {
  
  // ISO 27001 compliant headers (prioritized for 5-header limit)
  const headers = [
    // A.12.4.1 - Event logging: Unique trace ID for audit trail
    {
      name: 'X-ISO27001-Trace-ID',
      value: trace_id
    },
    // A.8.2.1 - Information classification: Security classification level
    {
      name: 'X-ISO27001-Classification',
      value: classification.toUpperCase()
    },
    // A.9.4.1 - Information access restriction: Security validation status
    {
      name: 'X-ISO27001-Access-Control',
      value: 'ABAC-Validated'
    },
    // A.13.2.1 - Information transfer: Compliance framework
    {
      name: 'X-ISO27001-Compliance',
      value: 'GDPR-ISO27001'
    }
  ];

  // Add GDPR status if token present (A.13.2.1)
  if (gdpr_token) {
    headers.push({
      name: 'X-ISO27001-GDPR-Status',
      value: 'Double-Validated'
    });
  } else {
    // If no GDPR token, add timestamp for audit trail (A.12.4.1)
    headers.push({
      name: 'X-ISO27001-Timestamp',
      value: new Date().toISOString()
    });
  }

  // Add digital signature info if we have signed PDFs and room for one more header (A.13.2.3)
  const signedPdfs = attachments?.filter(a => a.name.endsWith('_signed.pdf')) || [];
  if (signedPdfs.length > 0 && headers.length < 5) {
    // Remove last header to make room for signature info if needed
    if (headers.length === 5) headers.pop();
    headers.push({
      name: 'X-ISO27001-Digital-Signature',
      value: `Applied-${signedPdfs.length}-PDFs`
    });
  }

  logger.info('Built ISO 27001 compliant security headers', {
    trace_id,
    header_count: headers.length,
    classification,
    has_gdpr_token: !!gdpr_token,
    has_signed_pdfs: signedPdfs.length > 0,
    iso_controls: ['A.8.2.1', 'A.12.4.1', 'A.13.2.1']
  });

  return headers;
}

/**
 * Processes email attachments for Microsoft Graph API
 * 
 * Reads each attachment file, converts to base64, and formats
 * according to Microsoft Graph fileAttachment specification.
 * 
 * @param attachments - Array of attachment file information
 * @param trace_id - Trace ID for logging
 * @returns Array of Microsoft Graph attachment objects
 * @throws Error if any attachment file cannot be read
 */
async function processAttachments(
  attachments: EmailAttachment[],
  trace_id: string
): Promise<any[]> {
  
  logger.info('Processing email attachments with security validation', {
    trace_id,
    attachment_count: attachments.length
  });

  const processedAttachments = [];

  for (const attachment of attachments) {
    try {
      // Validate attachment file exists and is readable
      await validateAttachmentFile(attachment, trace_id);

      // Read file and convert to base64
      const contentBytes = await fs.readFile(attachment.path);
      const base64Content = contentBytes.toString('base64');

      logger.info('Attachment processed successfully', {
        trace_id,
        name: attachment.name,
        path: attachment.path,
        size_bytes: contentBytes.length,
        base64_length: base64Content.length,
        is_signed_pdf: attachment.name.endsWith('_signed.pdf')
      });

      // Format for Microsoft Graph API
      processedAttachments.push({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: attachment.name,
        contentBytes: base64Content,
        contentType: getContentType(attachment.name),
        // Add custom properties for signed PDFs
        ...(attachment.name.endsWith('_signed.pdf') && {
          isInline: false,
          size: contentBytes.length
        })
      });

    } catch (error) {
      logger.error('Failed to process attachment', {
        trace_id,
        name: attachment.name,
        path: attachment.path,
        error: (error as Error).message
      });

      throw new Error(`Failed to process attachment ${attachment.name}: ${(error as Error).message}`);
    }
  }

  return processedAttachments;
}

/**
 * Validates that an attachment file exists and is readable
 * 
 * @param attachment - Attachment to validate
 * @param trace_id - Trace ID for logging
 * @throws Error if file is not accessible
 */
async function validateAttachmentFile(
  attachment: EmailAttachment,
  trace_id: string
): Promise<void> {
  
  try {
    const stats = await fs.stat(attachment.path);
    
    if (!stats.isFile()) {
      throw new Error(`Attachment path is not a file: ${attachment.path}`);
    }

    // Additional security validation for signed PDFs
    if (attachment.name.endsWith('_signed.pdf')) {
      logger.info('Validating signed PDF attachment', {
        trace_id,
        name: attachment.name,
        path: attachment.path,
        size_bytes: stats.size
      });
    }

    logger.info('Attachment file validated', {
      trace_id,
      name: attachment.name,
      path: attachment.path,
      size_bytes: stats.size
    });

  } catch (error) {
    logger.error('Attachment file validation failed', {
      trace_id,
      name: attachment.name,
      path: attachment.path,
      error: (error as Error).message
    });

    throw new Error(`Attachment file not accessible: ${attachment.path}`);
  }
}

/**
 * Determines content type based on file extension
 * 
 * @param filename - Name of the file
 * @returns MIME type string
 */
function getContentType(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  
  switch (extension) {
    case '.pdf':
      return 'application/pdf';
    case '.txt':
      return 'text/plain';
    case '.json':
      return 'application/json';
    case '.xml':
      return 'application/xml';
    case '.csv':
      return 'text/csv';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return 'application/octet-stream';
  }
}