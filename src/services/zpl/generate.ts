import fs from 'fs';
import path from 'path';
import mustache from 'mustache';
import { config } from '../../config/config';

/**
 * Generates a ZPL string using a mustache template and dynamic data.
 * @param data Input JSON containing `core_report_info` and custom data
 * @returns Rendered ZPL string
 * @throws Error if template is missing or cannot be rendered
 */
export const generateZPL = async (data: any): Promise<string> => {
  const templateName = data.core_report_info?.report_template;

  if (!templateName) {
    throw new Error('Missing report_template in core_report_info');
  }

  const templatePath = path.join(config.zpl.templatePath, `${templateName}.zpl`);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`ZPL template not found: ${templatePath}`);
  }

  const zplTemplate = fs.readFileSync(templatePath, 'utf-8');
  const zplRendered = mustache.render(zplTemplate, data);

  console.log(`[core-services] ZPL generated successfully: ${templateName}`);

  return zplRendered;
};
