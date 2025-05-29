import { sendEmail as sendEmailService } from '../../services/email/emailService';

/**
 * Wrapper function for sending emails using the emailService.
 * Expects a data object with: from, to, subject, body, and optional attachments.
 * Returns a string indicating success or failure.
 */
export async function sendEmail(data: any): Promise<string> {
  if (!data || !data.to || !data.subject || !data.body) {
    throw new Error('Missing required email fields: to, subject, or body');
  }

  console.log('[core-services] Sending email to:', data.to);

  const result = await sendEmailService(data);

  console.log('[core-services] Email sent with status:', result);

  return `Email sent successfully (status: ${result})`;
}
