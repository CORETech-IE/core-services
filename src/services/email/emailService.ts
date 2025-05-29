import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { config } from '../../config/config';
import envConfig from '../../config/envConfig';
import { getAccessToken } from '../../services/email/tokenService';

export interface EmailParams {
  from?: string;
  to: string;
  subject: string;
  body: string;
  attachments?: string[]; // Absolute paths to files
}

export async function sendEmail({
  from,
  to,
  subject,
  body,
  attachments = []
}: EmailParams): Promise<number> {
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

  // Optional file attachments
  if (attachments.length > 0) {
    emailPayload.message.attachments = await Promise.all(
      attachments.map(async (filePath) => {
        const contentBytes = await fs.readFile(filePath).then(b =>
          b.toString('base64')
        );

        console.log('[core-services] 📎 Attaching file:', {
          name: path.basename(filePath),
          size: contentBytes.length
        });

        return {
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: path.basename(filePath),
          contentBytes,
          contentType: 'application/octet-stream'
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

  console.log(`[core-services] Email sent successfully to: ${to}`);
  return response.status;
}
