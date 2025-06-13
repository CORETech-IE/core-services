import fs from 'fs';
import path from 'path';
import mustache from 'mustache';
import { paths } from "../../config/paths";
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logging';

/**
 * Generates a ZPL string using a mustache template and dynamic data.
 * @param data Input JSON containing `core_report_info` and custom data
 * @returns Rendered ZPL string
 * @throws Error if template is missing or cannot be rendered
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

  if (!templateName) {
    logger.zpl('ZPL generation failed - missing template name', {
      trace_id,
      duration_ms: Date.now() - startTime,
      error_code: 'MISSING_TEMPLATE_NAME',
      has_core_report_info: !!data.core_report_info
    });
    throw new Error('Missing report_template in core_report_info');
  }

  const templatePath = path.join(paths.zpl.templatePath, `${templateName}.zpl`);
  
  logger.zpl('Checking template file', {
    trace_id,
    template_path: templatePath,
    template_name: templateName,
    duration_ms: Date.now() - startTime
  });

  if (!fs.existsSync(templatePath)) {
    logger.zpl('ZPL generation failed - template not found', {
      trace_id,
      duration_ms: Date.now() - startTime,
      error_code: 'TEMPLATE_NOT_FOUND',
      template_path: templatePath,
      template_name: templateName
    });
    throw new Error(`ZPL template not found: ${templatePath}`);
  }

  try {
    logger.zpl('Reading template file', {
      trace_id,
      template_path: templatePath,
      duration_ms: Date.now() - startTime
    });

    const zplTemplate = fs.readFileSync(templatePath, 'utf-8');
    const templateSize = zplTemplate.length;
    
    logger.zpl('Template loaded, rendering with Mustache', {
      trace_id,
      template_size_bytes: templateSize,
      template_size_chars: templateSize,
      data_keys: Object.keys(data).length,
      duration_ms: Date.now() - startTime
    });

    const renderStartTime = Date.now();
    const zplRendered = mustache.render(zplTemplate, data);
    const renderDuration = Date.now() - renderStartTime;
    
    // Calculate metrics
    const totalDuration = Date.now() - startTime;
    const outputSize = zplRendered.length;
    const compressionRatio = templateSize > 0 ? (outputSize / templateSize).toFixed(2) : '0';
    
    // Count labels (estimate based on ^XA commands which start a label)
    const labelCount = (zplRendered.match(/\^XA/g) || []).length;
    
    logger.zpl('ZPL generated successfully', {
      trace_id,
      duration_ms: totalDuration,
      render_duration_ms: renderDuration,
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

    // Legacy console log for backward compatibility
    console.log(
      `[core-services] ZPL generated successfully: ${templateName} (${labelCount} labels, ${outputSize} chars, ${totalDuration}ms)`
    );

    return zplRendered;
    
  } catch (error) {
    const errorDuration = Date.now() - startTime;
    const errorMessage = (error as Error).message;
    
    logger.zpl('ZPL generation failed during rendering', {
      trace_id,
      duration_ms: errorDuration,
      error_code: 'RENDERING_ERROR',
      error_message: errorMessage,
      stack: (error as Error).stack,
      template_name: templateName,
      template_path: templatePath
    });
    
    throw error;
  }
};