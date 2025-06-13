// src/services/zpl/generate.ts - VERSIÓN MEJORADA
import fs from 'fs';
import path from 'path';
import mustache from 'mustache';
import { paths } from "../../config/paths";
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logging';

/**
 * Estructura de error mejorada para ZPL generation
 */
class ZPLGenerationError extends Error {
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
    this.name = 'ZPLGenerationError';
    this.code = code;
    this.details = details;
    this.userAction = userAction;
    this.statusCode = statusCode;
    this.traceId = traceId;
  }
}

/**
 * Generates a ZPL string using a mustache template and dynamic data.
 * @param data Input JSON containing `core_report_info` and custom data
 * @returns Rendered ZPL string
 * @throws ZPLGenerationError if template is missing or cannot be rendered
 */
export const generateZPL = async (data: any): Promise<string> => {
  const startTime = Date.now();
  const trace_id = uuidv4();
  const templateName = data.core_report_info?.report_template;
  
  logger.zpl('Starting ZPL generation', {
    trace_id,
    correlation_id: trace_id,
    client_name: data.client_name,
    template_name: templateName,
    report_name: data.core_report_info?.report_name,
    report_file_name: data.core_report_info?.report_file_name
  });

  // VALIDACIÓN MEJORADA
  try {
    validateZPLRequest(data, trace_id);
  } catch (error) {
    if (error instanceof ZPLGenerationError) {
      throw error;
    }
    throw new ZPLGenerationError(
      'ZPL request validation failed',
      'VALIDATION_ERROR',
      (error as Error).message,
      'Check your request format and ensure all required fields are provided',
      400,
      trace_id
    );
  }

  const templatePath = path.join(paths.zpl.templatePath, `${templateName}.zpl`);
  
  try {
    // PASO 1: Verificar template existe
    logger.zpl('Verifying template file', {
      trace_id,
      template_path: templatePath,
      template_name: templateName,
      duration_ms: Date.now() - startTime
    });

    await validateTemplateExists(templatePath, templateName, trace_id);

    // PASO 2: Leer template
    logger.zpl('Reading template file', {
      trace_id,
      template_path: templatePath,
      duration_ms: Date.now() - startTime
    });

    const zplTemplate = await readTemplateSafely(templatePath, trace_id);
    const templateSize = zplTemplate.length;
    
    // PASO 3: Validar template content
    validateTemplateContent(zplTemplate, templateName, trace_id);
    
    // PASO 4: Renderizar con Mustache
    logger.zpl('Rendering template with Mustache', {
      trace_id,
      template_size_bytes: templateSize,
      template_size_chars: templateSize,
      data_keys: Object.keys(data).length,
      duration_ms: Date.now() - startTime
    });

    const zplRendered = await renderTemplateSafely(zplTemplate, data, templateName, trace_id);
    
    // PASO 5: Validar output
    validateZPLOutput(zplRendered, trace_id);
    
    // PASO 6: Métricas finales
    const totalDuration = Date.now() - startTime;
    const outputSize = zplRendered.length;
    const compressionRatio = templateSize > 0 ? (outputSize / templateSize).toFixed(2) : '0';
    const labelCount = countZPLLabels(zplRendered);
    
    logger.zpl('ZPL generated successfully', {
      trace_id,
      duration_ms: totalDuration,
      template_name: templateName,
      template_size_bytes: templateSize,
      output_size_bytes: outputSize,
      output_size_chars: outputSize,
      compression_ratio: compressionRatio,
      zpl_labels: labelCount,
      estimated_labels: labelCount,
      report_name: data.core_report_info?.report_name,
      report_file_name: data.core_report_info?.report_file_name
    });

    return zplRendered;
    
  } catch (error) {
    const errorDuration = Date.now() - startTime;
    
    // Si ya es nuestro error estructurado, re-lanzar
    if (error instanceof ZPLGenerationError) {
      logger.zpl('ZPL generation failed with structured error', {
        trace_id,
        duration_ms: errorDuration,
        error_code: error.code,
        error_message: error.message,
        template_name: templateName
      });
      throw error;
    }
    
    // Convertir errores no estructurados
    const structuredError = createStructuredZPLError(error as Error, trace_id, templateName);
    
    logger.zpl('ZPL generation failed', {
      trace_id,
      duration_ms: errorDuration,
      error_code: structuredError.code,
      error_message: structuredError.message,
      original_error: (error as Error).message,
      template_name: templateName
    });
    
    throw structuredError;
  }
};

/**
 * Validación mejorada del request
 */
function validateZPLRequest(data: any, trace_id: string): void {
  if (!data.core_report_info) {
    throw new ZPLGenerationError(
      'Missing core_report_info',
      'MISSING_REPORT_INFO',
      'The core_report_info object is required but was not provided',
      'Include core_report_info in your request with the report_template field',
      400,
      trace_id
    );
  }

  const templateName = data.core_report_info.report_template;
  if (!templateName) {
    throw new ZPLGenerationError(
      'Missing template name',
      'MISSING_TEMPLATE_NAME',
      'report_template field is required in core_report_info',
      'Specify a valid report_template name in core_report_info',
      400,
      trace_id
    );
  }

  // Validar caracteres peligrosos
  if (!/^[a-zA-Z0-9_-]+$/.test(templateName)) {
    throw new ZPLGenerationError(
      'Invalid template name',
      'INVALID_TEMPLATE_NAME',
      'Template name contains invalid characters',
      'Use only alphanumeric characters, underscores, and hyphens in template names',
      400,
      trace_id
    );
  }

  // Validar longitud del nombre
  if (templateName.length > 50) {
    throw new ZPLGenerationError(
      'Template name too long',
      'TEMPLATE_NAME_TOO_LONG',
      'Template name exceeds maximum length of 50 characters',
      'Use a shorter template name',
      400,
      trace_id
    );
  }
}

/**
 * Validar que el template existe
 */
async function validateTemplateExists(templatePath: string, templateName: string, trace_id: string): Promise<void> {
  try {
    const stats = await fs.promises.stat(templatePath);
    
    if (!stats.isFile()) {
      throw new ZPLGenerationError(
        'Template not found',
        'TEMPLATE_NOT_FILE',
        `Template path exists but is not a file: ${templatePath}`,
        'Ensure the template is a valid file, not a directory',
        404,
        trace_id
      );
    }

    // Verificar que sea legible
    await fs.promises.access(templatePath, fs.constants.R_OK);
    
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      throw new ZPLGenerationError(
        'Template not found',
        'TEMPLATE_NOT_FOUND',
        `ZPL template file does not exist: ${templatePath}`,
        `Ensure the template '${templateName}.zpl' exists in the templates directory, or contact your administrator`,
        404,
        trace_id
      );
    }

    if ((error as any).code === 'EACCES') {
      throw new ZPLGenerationError(
        'Template access denied',
        'TEMPLATE_ACCESS_DENIED',
        `Insufficient permissions to read template: ${templatePath}`,
        'Contact your system administrator to check file permissions',
        403,
        trace_id
      );
    }

    // Si ya es nuestro error, re-lanzar
    if (error instanceof ZPLGenerationError) {
      throw error;
    }

    throw new ZPLGenerationError(
      'Template validation failed',
      'TEMPLATE_VALIDATION_ERROR',
      `Failed to validate template: ${(error as Error).message}`,
      'Contact support if this problem persists',
      500,
      trace_id
    );
  }
}

/**
 * Leer template de manera segura
 */
async function readTemplateSafely(templatePath: string, trace_id: string): Promise<string> {
  try {
    const templateContent = await fs.promises.readFile(templatePath, 'utf-8');
    
    if (templateContent.length === 0) {
      throw new ZPLGenerationError(
        'Empty template file',
        'EMPTY_TEMPLATE',
        'Template file exists but contains no content',
        'Check the template file and ensure it contains valid ZPL content',
        400,
        trace_id
      );
    }

    return templateContent;
    
  } catch (error) {
    if (error instanceof ZPLGenerationError) {
      throw error;
    }

    throw new ZPLGenerationError(
      'Failed to read template',
      'TEMPLATE_READ_ERROR',
      `Error reading template file: ${(error as Error).message}`,
      'Contact your system administrator to check file permissions and disk space',
      500,
      trace_id
    );
  }
}

/**
 * Validar contenido del template
 */
function validateTemplateContent(templateContent: string, templateName: string, trace_id: string): void {
  // Validar que contiene comandos ZPL básicos
  if (!templateContent.includes('^XA') && !templateContent.includes('^xa')) {
    throw new ZPLGenerationError(
      'Invalid ZPL template',
      'INVALID_ZPL_CONTENT',
      'Template does not contain ZPL start command (^XA)',
      'Ensure the template contains valid ZPL commands starting with ^XA',
      400,
      trace_id
    );
  }

  // Validar tamaño razonable
  if (templateContent.length > 1024 * 1024) { // 1MB
    throw new ZPLGenerationError(
      'Template too large',
      'TEMPLATE_TOO_LARGE',
      'Template file exceeds maximum size of 1MB',
      'Use a smaller template or split into multiple templates',
      413,
      trace_id
    );
  }

  logger.zpl('Template content validated', {
    trace_id,
    template_name: templateName,
    content_length: templateContent.length,
    has_start_command: templateContent.includes('^XA') || templateContent.includes('^xa')
  });
}

/**
 * Renderizar template con Mustache de manera segura
 */
async function renderTemplateSafely(
  templateContent: string, 
  data: any, 
  templateName: string, 
  trace_id: string
): Promise<string> {
  try {
    const renderStartTime = Date.now();
    
    // Validar que data es serializable
    try {
      JSON.stringify(data);
    } catch (error) {
      throw new ZPLGenerationError(
        'Invalid data format',
        'DATA_NOT_SERIALIZABLE',
        'Template data contains non-serializable content',
        'Ensure all data values are JSON-serializable (no functions, circular references, etc.)',
        400,
        trace_id
      );
    }

    const zplRendered = mustache.render(templateContent, data);
    const renderDuration = Date.now() - renderStartTime;
    
    logger.zpl('Mustache rendering completed', {
      trace_id,
      template_name: templateName,
      render_duration_ms: renderDuration,
      input_size: templateContent.length,
      output_size: zplRendered.length
    });

    return zplRendered;
    
  } catch (error) {
    const errorMessage = (error as Error).message;
    
    if (error instanceof ZPLGenerationError) {
      throw error;
    }

    // Errores específicos de Mustache
    if (errorMessage.includes('Unclosed tag') || errorMessage.includes('Unopened tag')) {
      throw new ZPLGenerationError(
        'Template syntax error',
        'MUSTACHE_SYNTAX_ERROR',
        `Mustache template syntax error: ${errorMessage}`,
        'Check template syntax for unmatched {{}} tags and correct them',
        400,
        trace_id
      );
    }

    if (errorMessage.includes('Maximum call stack') || errorMessage.includes('RangeError')) {
      throw new ZPLGenerationError(
        'Template too complex',
        'TEMPLATE_COMPLEXITY_ERROR',
        'Template is too complex or contains circular references',
        'Simplify the template or check for recursive references in your data',
        400,
        trace_id
      );
    }

    throw new ZPLGenerationError(
      'Template rendering failed',
      'MUSTACHE_RENDER_ERROR',
      `Failed to render template: ${errorMessage}`,
      'Check template syntax and data format, or contact support if the error persists',
      500,
      trace_id
    );
  }
}

/**
 * Validar output ZPL
 */
function validateZPLOutput(zplOutput: string, trace_id: string): void {
  if (zplOutput.length === 0) {
    throw new ZPLGenerationError(
      'Empty ZPL output',
      'EMPTY_OUTPUT',
      'Template rendering produced no output',
      'Check that your template data contains the required values',
      500,
      trace_id
    );
  }

  // Validar tamaño razonable del output
  if (zplOutput.length > 10 * 1024 * 1024) { // 10MB
    throw new ZPLGenerationError(
      'ZPL output too large',
      'OUTPUT_TOO_LARGE',
      'Generated ZPL exceeds maximum size of 10MB',
      'Reduce the amount of data or use multiple smaller labels',
      413,
      trace_id
    );
  }

  logger.zpl('ZPL output validated', {
    trace_id,
    output_size: zplOutput.length,
    validation_passed: true
  });
}

/**
 * Contar labels en el ZPL
 */
function countZPLLabels(zplContent: string): number {
  // Contar comandos ^XA que inician una label
  const matches = zplContent.match(/\^XA/gi) || [];
  return matches.length;
}

/**
 * Crear error estructurado desde error genérico
 */
function createStructuredZPLError(
  originalError: Error, 
  trace_id: string, 
  templateName?: string
): ZPLGenerationError {
  const message = originalError.message;
  
  // Categorizar errores comunes
  if (message.includes('EACCES')) {
    return new ZPLGenerationError(
      'File access denied',
      'FILE_ACCESS_ERROR',
      'Insufficient permissions to access template files',
      'Contact your system administrator to check file permissions',
      403,
      trace_id
    );
  }

  if (message.includes('ENOENT')) {
    return new ZPLGenerationError(
      'Template not found',
      'TEMPLATE_NOT_FOUND',
      `Template file not found: ${templateName || 'unknown'}`,
      'Verify the template name and ensure the file exists',
      404,
      trace_id
    );
  }

  if (message.includes('EMFILE') || message.includes('ENFILE')) {
    return new ZPLGenerationError(
      'System resource exhausted',
      'RESOURCE_EXHAUSTION',
      'Too many open files',
      'The system is overloaded. Try again in a few minutes',
      503,
      trace_id
    );
  }

  if (message.includes('heap') || message.includes('memory')) {
    return new ZPLGenerationError(
      'Memory exhausted',
      'MEMORY_ERROR',
      'Insufficient memory to generate ZPL',
      'The template or data may be too large. Try reducing content size',
      507,
      trace_id
    );
  }

  // Error genérico
  return new ZPLGenerationError(
    'ZPL generation failed',
    'UNKNOWN_ERROR',
    `Unexpected error: ${message}`,
    'An unexpected error occurred. Contact support with this trace ID if the problem persists',
    500,
    trace_id
  );
}

// Export del error personalizado para uso en routes
export { ZPLGenerationError };