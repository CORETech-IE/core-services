import fs from 'fs';
import { plainAddPlaceholder } from 'node-signpdf';
const sign = require('node-signpdf').default;

interface SignPDFOptions {
  pdfPath: string;
  outputPath: string;
  certPath: string;
  certPassword?: string;
  type: 'p12' | 'pem';
}

export async function signPDF({
  pdfPath,
  outputPath,
  certPath,
  certPassword = '',
  type
}: SignPDFOptions): Promise<void> {
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfWithPlaceholder = plainAddPlaceholder({
    pdfBuffer,
    reason: 'Document signed electronically by CORE'
  });

  if (type === 'p12') {
    const p12Buffer = fs.readFileSync(certPath);
    const signedPdf = sign(pdfWithPlaceholder, Buffer.from(p12Buffer), {
      passphrase: certPassword
    });
    fs.writeFileSync(outputPath, signedPdf);
    return;
  }

  if (type === 'pem') {
    const certContent = fs.readFileSync(certPath, 'utf8');

    const certMatch = certContent.match(/-----BEGIN CERTIFICATE-----[^-]+-----END CERTIFICATE-----/s);
    const keyMatch = certContent.match(/-----BEGIN (?:RSA )?PRIVATE KEY-----[^-]+-----END (?:RSA )?PRIVATE KEY-----/s);

    if (!certMatch || !keyMatch) {
      throw new Error('Invalid PEM file: certificate or key not found');
    }

    const certificate = Buffer.from(certMatch[0]);
    const key = Buffer.from(keyMatch[0]);

    const signedPdf = sign(pdfWithPlaceholder, { key, cert: certificate });
    fs.writeFileSync(outputPath, signedPdf);
    return;
  }

  throw new Error('Unsupported certificate type');
}
