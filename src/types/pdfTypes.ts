// src/types/pdfTypes.ts

export interface PdfSigningConfig {
    certPdfSignPath: string;
    certPdfSignPassword: string;
    certPdfSignType: 'p12' | 'pem';
  }