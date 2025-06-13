import path from "path";
import { promises as fs } from "fs";
import { compileFile } from "pug";
import { paths } from "../../config/paths";
import { acquirePage, releasePage } from "../../config/browserPool";
import { sendLog } from "../../services/logEmitter";
import { v4 as uuidv4 } from "uuid";
import logger from "../../utils/logging";

interface CoreReportInfo {
  report_name: string;
  report_description: string;
  report_template: string;
  report_version: string;
  report_file_name: string;
  report_out_mode: string;
}

export async function generatePDF(data: any): Promise<Buffer> {
  const startTime = Date.now();
  const info: CoreReportInfo = data.core_report_info;
  const trace_id = uuidv4(); // Generate a unique trace ID for this request
  
  logger.pdf('Starting PDF generation', {
    trace_id,
    correlation_id: trace_id,
    client_name: data.client_name,
    report_name: info?.report_name,
    report_template: info?.report_template,
    report_file_name: info?.report_file_name
  });

  if (!info || !info.report_template) {
    logger.pdf('PDF generation failed - missing template info', {
      trace_id,
      duration_ms: Date.now() - startTime,
      error_code: 'MISSING_TEMPLATE_INFO',
      has_core_report_info: !!info,
      has_report_template: !!info?.report_template
    });
    throw new Error("Missing core_report_info or report_template");
  }

  const templatePath = path.join(paths.pdf.templatePath, `${info.report_template}.pug`);
  const cssPath = path.join(paths.pdf.cssPath, `${info.report_template}.css`);

  let page: any = null;
  
  try {
    logger.pdf('Loading template and CSS', {
      trace_id,
      template_path: templatePath,
      css_path: cssPath
    });

    const cssContent = await fs.readFile(cssPath, "utf-8");
    const compile = compileFile(templatePath);
    const html = compile({
      ...data,
      embeddedCSS: `<style>${cssContent}</style>`,
    });

    logger.pdf('Template compiled, acquiring browser page', {
      trace_id,
      html_length: html.length,
      duration_ms: Date.now() - startTime
    });

    page = await acquirePage();
    
    logger.pdf('Browser page acquired, rendering PDF', {
      trace_id,
      duration_ms: Date.now() - startTime
    });

    await page.setContent(html, { waitUntil: "domcontentloaded" });
    
    const pdfGenerationStart = Date.now();
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });
    const pdfGenerationTime = Date.now() - pdfGenerationStart;
    
    // Calculate metrics
    const totalDuration = Date.now() - startTime;
    const pdfSizeKB = Math.round(pdfBuffer.length / 1024);
    
    logger.pdf('PDF generated successfully', {
      trace_id,
      duration_ms: totalDuration,
      pdf_generation_ms: pdfGenerationTime,
      file_size_bytes: pdfBuffer.length,
      file_size_kb: pdfSizeKB,
      report_name: info.report_name,
      report_file_name: info.report_file_name,
      template: info.report_template
    });

    // Legacy log for backward compatibility (if needed)
    console.log(
      `[core-services] PDF generated successfully: ${info.report_file_name} (${pdfSizeKB}KB in ${totalDuration}ms)`
    );
    
    await sendLog({
      service: "pdf",
      level: "INFO",
      message: "PDF generated successfully",
      trace_id,
    });

    return pdfBuffer;
    
  } catch (error) {
    const errorDuration = Date.now() - startTime;
    const errorMessage = (error as Error).message;
    
    logger.pdf('PDF generation failed', {
      trace_id,
      duration_ms: errorDuration,
      error_code: 'PDF_GENERATION_ERROR',
      error_message: errorMessage,
      stack: (error as Error).stack,
      template: info?.report_template,
      report_name: info?.report_name
    });

    // Legacy log for backward compatibility
    await sendLog({
      service: "pdf",
      level: "ERROR",
      message: `Failed to generate PDF: ${errorMessage}`,
      trace_id,
    });
    
    throw error;
  } finally {
    if (page) {
      try {
        releasePage(page);
        logger.pdf('Browser page released', {
          trace_id,
          duration_ms: Date.now() - startTime
        });
      } catch (releaseError) {
        logger.pdf('Failed to release browser page', {
          trace_id,
          error_message: (releaseError as Error).message,
          duration_ms: Date.now() - startTime
        });
      }
    }
  }
}