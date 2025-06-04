// src/services/email/emailServiceHelpers.ts

import { sendEmail, EmailParams } from './emailService';
import { getServiceContainer } from '../serviceContainer';

/**
 * Send email using the initialized service container
 * Clean helper that automatically uses the correct config
 */
export async function sendEmailWithConfig(
  emailParams: EmailParams,
  trace_id: string
): Promise<number> {
  const container = getServiceContainer();
  const emailConfig = container.getEmailConfig();
  
  return sendEmail(emailParams, trace_id, emailConfig);
}

/**
 * Export for easy importing
 */
export { EmailParams, EmailAttachment } from './emailService';