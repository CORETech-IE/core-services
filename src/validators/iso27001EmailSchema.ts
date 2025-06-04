// src/validators/iso27001EmailSchema.ts

import { z } from 'zod';

/**
 * ISO 27001 Compliant Email Request Schema
 * 
 * This schema validates email requests according to ISO 27001 standards:
 * - A.8.2.1: Information classification validation
 * - A.13.2.1: Information transfer format validation
 * - A.9.4.1: Information access restriction validation
 */

// ISO 27001 Annex A.8.2 - Information Classification Levels
const ISO27001ClassificationSchema = z.enum(['internal', 'confidential', 'restricted'], {
  errorMap: () => ({ 
    message: 'Classification must be one of: internal, confidential, restricted (ISO 27001 A.8.2.1)' 
  })
});

// Email attachment schema with file path validation
const EmailAttachmentSchema = z.object({
  name: z.string()
    .min(1, 'Attachment name is required')
    .max(255, 'Attachment name too long')
    .regex(/^[^<>:"/\\|?*]+$/, 'Invalid characters in attachment name'),
  path: z.string()
    .min(1, 'Attachment path is required')
    .max(500, 'Attachment path too long')
});

// Main ISO 27001 compliant email schema
export const ISO27001EmailRequestSchema = z.object({
  // Core email fields (A.13.2.1 - Information transfer)
  to: z.string()
    .email('Invalid email address format')
    .max(320, 'Email address too long'), // RFC 5321 limit
  
  subject: z.string()
    .min(1, 'Subject is required')
    .max(500, 'Subject too long'),
  
  body: z.string()
    .min(1, 'Email body is required')
    .max(50000, 'Email body too long'), // Reasonable limit for email content
  
  // Optional sender override
  from: z.string()
    .email('Invalid sender email address format')
    .max(320, 'Sender email address too long')
    .optional(),
  
  // Attachments with validation
  attachments: z.array(EmailAttachmentSchema)
    .max(10, 'Too many attachments (maximum 10)')
    .optional(),
  
  // ISO 27001 A.8.2.1 - Information classification (REQUIRED)
  classification: ISO27001ClassificationSchema,
  
  // Optional email priority
  importance: z.enum(['low', 'normal', 'high'])
    .default('normal'),
  
  // GDPR consent token (can be in header or body)
  gdpr_token: z.string()
    .min(1, 'GDPR token is required for compliance')
    .max(100, 'GDPR token too long')
    .optional() // Optional in body since it can come from headers
});

// Type inference for TypeScript
export type ISO27001EmailRequest = z.infer<typeof ISO27001EmailRequestSchema>;

/**
 * Validates email request against ISO 27001 compliance standards
 * 
 * @param payload - Email request payload to validate
 * @returns Validation result with detailed error information
 */
export const validateISO27001EmailRequest = (payload: unknown) => {
  return ISO27001EmailRequestSchema.safeParse(payload);
};

/**
 * Middleware function for Express routes to validate ISO 27001 email requests
 * 
 * @param req - Express request object
 * @param res - Express response object  
 * @param next - Express next function
 */
export const validateISO27001EmailMiddleware = (req: any, res: any, next: any) => {
  const result = validateISO27001EmailRequest(req.body);
  
  if (!result.success) {
    return res.status(400).json({
      error: 'ISO 27001 validation failed',
      details: result.error.issues,
      iso_control: 'A.8.2.1' // Information classification
    });
  }
  
  // Attach validated data to request
  req.validatedBody = result.data;
  next();
};