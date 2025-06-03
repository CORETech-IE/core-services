import fs from 'fs';
import { plainAddPlaceholder } from 'node-signpdf';
import envConfig from '../config/envConfig';
const { SignPdf } = require('node-signpdf');

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
  certPath = envConfig.certPdfSignPath,
  certPassword = envConfig.certPdfSignPassword,
  type
}: SignPDFOptions): Promise<void> {
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfWithPlaceholder = plainAddPlaceholder({
    pdfBuffer,
    reason: 'Document signed electronically by CORE'
  });

  const signer = new SignPdf();

  if (type === 'p12') {
    const p12Buffer = fs.readFileSync(certPath);
    
    // We are using the SignPdf class from node-signpdf on version 3.0.0 or later, which supports signing with P12 certificates.
    const signedPdf = signer.sign(pdfWithPlaceholder, p12Buffer, {
      passphrase: certPassword,
      timestampURL: 'http://timestamp.digicert.com' // Optional: You can specify a timestamp URL. This is a common practice for PDF signing.
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
    
    const signedPdf = signer.sign(pdfWithPlaceholder, { 
      key, 
      cert: certificate 
    });
    
    fs.writeFileSync(outputPath, signedPdf);
    return;
  }

  throw new Error('Unsupported certificate type');
}