import path from 'path';
import { promises as fs } from 'fs';
import { compileFile } from 'pug';
import puppeteer from 'puppeteer';
import { config } from '../../config/config';

interface CoreReportInfo {
  report_name: string;
  report_description: string;
  report_template: string;
  report_version: string;
  report_file_name: string;
  report_out_mode: string;
}

export async function generatePDF(data: any): Promise<Buffer> {
  // Extract core_report_info block
  const info: CoreReportInfo = data.core_report_info;

  if (!info || !info.report_template) {
    throw new Error('Missing core_report_info or report_template');
  }

  // Resolve paths to Pug template and CSS file
  const templatePath = path.join(config.pdf.templatePath, `${info.report_template}.pug`);
  const cssPath = path.join(config.pdf.cssPath, `${info.report_template}.css`);

  // Load CSS content and inject into template as embedded style
  const cssContent = await fs.readFile(cssPath, 'utf-8');

  // Compile Pug template
  const compile = compileFile(templatePath);
  const html = compile({ ...data, embeddedCSS: `<style>${cssContent}</style>` });

  // Launch Puppeteer and generate PDF
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.platform === 'win32' ? undefined : '/usr/bin/google-chrome'
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true
  });

  await browser.close();

  console.log(`[core-services] PDF generated successfully: ${info.report_file_name}`);

  return pdfBuffer;
}
