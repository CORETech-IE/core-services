// config/paths.ts
import path from 'path';

/**
 * Static paths configuration
 * These paths are fixed and don't depend on client configuration
 */
export const paths = {
  pdf: {
    templatePath: path.resolve(__dirname, '../../../reports_templates/templates'),
    cssPath: path.resolve(__dirname, '../../../reports_templates/css')
  },
  zpl: {
    templatePath: path.resolve(__dirname, '../../../reports_templates/templates')
  }
};