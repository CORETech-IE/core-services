import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { config } from '../../config/config';
import envConfig from '../../config/envConfig';
import { getAccessToken } from './tokenService';
import { logger } from '../../utils/logger';
import { signPDF } from '../../utils/pdfSigner';

export interface EmailAttachment {
  name: string;
  path: string;
}

export interface EmailParams {
  from?: string;
  to: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail(
  { from, to, subject, body, attachments = [] }: EmailParams,
  trace_id: string
): Promise<number> {
  const signedAttachments: EmailAttachment[] = [];

  for (const attachment of attachments) {
    if (attachment.name.endsWith('_signed.pdf')) {
      signedAttachments.push(attachment);
      continue;
    }

    const signedName = attachment.name.replace(/\.pdf$/, '_signed.pdf');
    const signedPath = attachment.path.replace(/\.pdf$/, '_signed.pdf');

    logger.info('🖋️ Signing PDF', {
      trace_id,
      original: attachment.path,
      signed: signedPath
    });

    await signPDF({
      pdfPath: attachment.path,
      outputPath: signedPath,
      certPath: envConfig.certPdfSignPath,
      certPassword: envConfig.certPdfSignPassword || '',
      type: envConfig.certPdfSignType as 'p12' | 'pem'
    });

    signedAttachments.push({
      name: signedName,
      path: signedPath
    });
  }

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
      ]
    },
    saveToSentItems: true
  };

  if (signedAttachments.length > 0) {
    emailPayload.message.attachments = await Promise.all(
      signedAttachments.map(async ({ path: filePath, name }) => {
        const contentBytes = await fs.readFile(filePath).then(b =>
          b.toString('base64')
        );

        logger.info('📎 Attaching file', {
          trace_id,
          name,
          size: contentBytes.length
        });

        return {
          '@odata.type': '#microsoft.graph.fileAttachment',
          name,
          contentBytes,
          contentType: 'application/pdf'
        };
      })
    );
  }

  const accessToken = await getAccessToken();
  const sender = from || envConfig.senderEmail;

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

  logger.info('Email sent successfully', {
    trace_id,
    to,
    sender,
    status: response.status
  });

  return response.status;
}
