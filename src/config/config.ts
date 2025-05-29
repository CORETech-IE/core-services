import path from 'path';

const baseTemplatePath = process.env.TEMPLATES_BASE_PATH || path.resolve(__dirname, '../../../reports_templates');

export const config = {
  pdf: {
    templatePath: path.join(baseTemplatePath, 'templates'),
    cssPath: path.join(baseTemplatePath, 'css')
  },
  zpl: {
    templatePath: path.join(baseTemplatePath, 'templates')
  },
  email: {
    smtpHost: 'smtp.example.com',
    smtpPort: 587
  }
};
