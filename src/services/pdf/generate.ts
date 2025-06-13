// src/services/pdf/generate.ts - VERSIÓN MEJORADA
import path from "path";
import { promises as fs } from "fs";
import { compileFile } from "pug";
import { paths } from "../../config/paths";
import { acquirePage, releasePage } from "../../config/browserPool";
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

/**
 * Estructura de error mejorada para PDF generation
 */
class PDFGenerationError extends Error {
  public readonly code: string;
  public readonly details: string;
  public readonly userAction: string;
  public readonly statusCode: number;
  public readonly traceId: string;

  constructor(
    message: string,
    code: string,
    details: string,
    userAction: string,
    statusCode: number = 500,
    traceId: string
  ) {
    super(message);
    this.name = 'PDFGenerationError';
    this.code = code;
    this.details = details;
    this.userAction = userAction;
    this.statusCode = statusCode;
    this.traceId = traceId;
  }
}

export async function generatePDF(data: any): Promise<Buffer> {
  const startTime = Date.now();
  const info: CoreReportInfo = data.core_report_info;
  const trace_id = uuidv4();
  
  logger.pdf('Starting PDF generation', {
    trace_id,
    correlation_id: trace_id,
    client_name: data.client_name,
    report_name: info?.report_name,
    report_template: info?.report_template,
    report_file_name: info?.report_file_name
  });

  // VALIDACIÓN MEJORADA
  try {
    validatePDFRequest(info, trace_id);
  } catch (error) {
    if (error instanceof PDFGenerationError) {
      throw error;
    }
    throw new PDFGenerationError(
      'PDF request validation failed',
      'VALIDATION_ERROR',
      (error as Error).message,
      'Check your request format and ensure all required fields are provided',
      400,
      trace_id
    );
  }

  const templatePath = path.join(paths.pdf.templatePath, `${info.report_template}.pug`);
  const cssPath = path.join(paths.pdf.cssPath, `${info.report_template}.css`);

  let page: any = null;
  
  try {
    // PASO 1: Verificar archivos de template
    logger.pdf('Verifying template files', {
      trace_id,
      template_path: templatePath,
      css_path: cssPath
    });

    await validateTemplateFiles(templatePath, cssPath, trace_id);

    // PASO 2: Leer y compilar template
    logger.pdf('Loading and compiling template', {
      trace_id,
      template_path: templatePath
    });

    const [cssContent, htmlContent] = await compileTemplate(templatePath, cssPath, data, trace_id);

    // PASO 3: Adquirir página del browser pool
    logger.pdf('Acquiring browser page from pool', {
      trace_id,
      html_length: htmlContent.length,
      duration_ms: Date.now() - startTime
    });

    page = await acquirePageSafely(trace_id);
    
    // PASO 4: Generar PDF
    logger.pdf('Rendering PDF content', {
      trace_id,
      duration_ms: Date.now() - startTime
    });

    const pdfBuffer = await renderPDF(page, htmlContent, trace_id);
    
    // PASO 5: Métricas finales y retorno
    const totalDuration = Date.now() - startTime;
    const pdfSizeKB = Math.round(pdfBuffer.length / 1024);
    
    logger.pdf('PDF generated successfully', {
      trace_id,
      duration_ms: totalDuration,
      file_size_bytes: pdfBuffer.length,
      file_size_kb: pdfSizeKB,
      report_name: info.report_name,
      report_file_name: info.report_file_name,
      template: info.report_template
    });

    return pdfBuffer;
    
  } catch (error) {
    const errorDuration = Date.now() - startTime;
    
    // Si ya es nuestro error estructurado, re-lanzar
    if (error instanceof PDFGenerationError) {
      logger.pdf('PDF generation failed with structured error', {
        trace_id,
        duration_ms: errorDuration,
        error_code: error.code,
        error_message: error.message,
        template: info?.report_template
      });
      throw error;
    }
    
    // Convertir errores no estructurados a errores estructurados
    const structuredError = createStructuredPDFError(error as Error, trace_id, info);
    
    logger.pdf('PDF generation failed', {
      trace_id,
      duration_ms: errorDuration,
      error_code: structuredError.code,
      error_message: structuredError.message,
      original_error: (error as Error).message,
      template: info?.report_template
    });
    
    throw structuredError;
    
  } finally {
    // SIEMPRE liberar la página
    if (page) {
      try {
        await releasePage(page);
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

/**
 * Validación mejorada del request
 */
function validatePDFRequest(info: CoreReportInfo, trace_id: string): void {
  if (!info) {
    throw new PDFGenerationError(
      'Missing core_report_info',
      'MISSING_REPORT_INFO',
      'The core_report_info object is required but was not provided',
      'Include core_report_info in your request with all required fields',
      400,
      trace_id
    );
  }

  if (!info.report_template) {
    throw new PDFGenerationError(
      'Missing report template',
      'MISSING_TEMPLATE',
      'report_template field is required in core_report_info',
      'Specify a valid report_template name in core_report_info',
      400,
      trace_id
    );
  }

  // Validar caracteres peligrosos
  if (!/^[a-zA-Z0-9_-]+$/.test(info.report_template)) {
    throw new PDFGenerationError(
      'Invalid template name',
      'INVALID_TEMPLATE_NAME',
      'Template name contains invalid characters',
      'Use only alphanumeric characters, underscores, and hyphens in template names',
      400,
      trace_id
    );
  }
}

/**
 * Validar que existan los archivos de template
 */
async function validateTemplateFiles(templatePath: string, cssPath: string, trace_id: string): Promise<void> {
  try {
    await fs.access(templatePath, fs.constants.R_OK);
  } catch (error) {
    throw new PDFGenerationError(
      'Template file not found',
      'TEMPLATE_NOT_FOUND',
      `Template file does not exist: ${templatePath}`,
      'Ensure the template file exists and is readable, or contact the system administrator',
      404,
      trace_id
    );
  }

  try {
    await fs.access(cssPath, fs.constants.R_OK);
  } catch (error) {
    logger.pdf('CSS file not found, continuing without styles', {
      trace_id,
      css_path: cssPath,
      warning: 'PDF will be generated without custom styles'
    });
  }
}

/**
 * Compilar template de manera segura
 */
async function compileTemplate(
  templatePath: string, 
  cssPath: string, 
  data: any, 
  trace_id: string
): Promise<[string, string]> {
  try {
    // Leer CSS (opcional)
    let cssContent = '';
    try {
      cssContent = await fs.readFile(cssPath, "utf-8");
    } catch {
      // CSS es opcional
      logger.pdf('No CSS file found, using default styles', { trace_id });
    }

    // Compilar template Pug
    const compile = compileFile(templatePath);
    const htmlContent = compile({
      ...data,
      embeddedCSS: cssContent ? `<style>${cssContent}</style>` : '',
    });

    return [cssContent, htmlContent];

  } catch (error) {
    if ((error as Error).message.includes('ENOENT')) {
      throw new PDFGenerationError(
        'Template compilation failed',
        'TEMPLATE_NOT_FOUND',
        `Template file not found: ${templatePath}`,
        'Verify the template name and ensure the file exists',
        404,
        trace_id
      );
    }

    throw new PDFGenerationError(
      'Template compilation failed',
      'TEMPLATE_COMPILATION_ERROR',
      `Failed to compile Pug template: ${(error as Error).message}`,
      'Check template syntax and data format, or contact support if the error persists',
      500,
      trace_id
    );
  }
}

/**
 * Adquirir página de manera segura
 */
async function acquirePageSafely(trace_id: string): Promise<any> {
  try {
    return await acquirePage();
  } catch (error) {
    throw new PDFGenerationError(
      'Browser page unavailable',
      'BROWSER_POOL_ERROR',
      `Failed to acquire browser page: ${(error as Error).message}`,
      'The system is experiencing high load. Try again in a few seconds',
      503,
      trace_id
    );
  }
}

/**
 * Renderizar PDF de manera segura
 */
async function renderPDF(page: any, htmlContent: string, trace_id: string): Promise<Buffer> {
  try {
    await page.setContent(htmlContent, { 
      waitUntil: "domcontentloaded",
      timeout: 30000 
    });
    
    const pdfGenerationStart = Date.now();
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      timeout: 30000
    });
    const pdfGenerationTime = Date.now() - pdfGenerationStart;

    logger.pdf('PDF rendering completed', {
      trace_id,
      pdf_generation_ms: pdfGenerationTime,
      file_size_bytes: pdfBuffer.length
    });

    return pdfBuffer;

  } catch (error) {
    const errorMessage = (error as Error).message;
    
    if (errorMessage.includes('timeout') || errorMessage.includes('Navigation timeout')) {
      throw new PDFGenerationError(
        'PDF generation timeout',
        'PDF_TIMEOUT',
        'PDF generation took too long to complete',
        'The document may be too complex. Try simplifying the content or contact support',
        408,
        trace_id
      );
    }

    if (errorMessage.includes('Protocol error') || errorMessage.includes('Target closed')) {
      throw new PDFGenerationError(
        'Browser connection lost',
        'BROWSER_CONNECTION_ERROR',
        'Connection to browser was lost during PDF generation',
        'This is usually temporary. Try again in a few seconds',
        503,
        trace_id
      );
    }

    throw new PDFGenerationError(
      'PDF rendering failed',
      'PDF_RENDER_ERROR',
      `Browser failed to render PDF: ${errorMessage}`,
      'Check your document content and try again, or contact support if the error persists',
      500,
      trace_id
    );
  }
}

/**
 * Crear error estructurado desde error genérico
 */
function createStructuredPDFError(
  originalError: Error, 
  trace_id: string, 
  info?: CoreReportInfo
): PDFGenerationError {
  const message = originalError.message;
  
  // Categorizar errores comunes
  if (message.includes('EACCES')) {
    return new PDFGenerationError(
      'File access denied',
      'FILE_ACCESS_ERROR',
      'Insufficient permissions to access template files',
      'Contact your system administrator to check file permissions',
      403,
      trace_id
    );
  }

  if (message.includes('EMFILE') || message.includes('ENFILE')) {
    return new PDFGenerationError(
      'System resource exhausted',
      'RESOURCE_EXHAUSTION',
      'Too many open files or browser instances',
      'The system is overloaded. Try again in a few minutes',
      503,
      trace_id
    );
  }

  if (message.includes('heap') || message.includes('memory')) {
    return new PDFGenerationError(
      'Memory exhausted',
      'MEMORY_ERROR',
      'Insufficient memory to generate PDF',
      'The document may be too large. Try reducing content or contact support',
      507,
      trace_id
    );
  }

  // Error genérico
  return new PDFGenerationError(
    'PDF generation failed',
    'UNKNOWN_ERROR',
    `Unexpected error: ${message}`,
    'An unexpected error occurred. Contact support with this trace ID if the problem persists',
    500,
    trace_id
  );
}

// Export del error personalizado para uso en routes
export { PDFGenerationError };