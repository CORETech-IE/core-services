import { z } from 'zod';

// Define the structure of core_report_info
export const coreReportInfoSchema = z.object({
  report_name: z.string().min(1),
  report_description: z.string().min(1),
  report_template: z.string().min(1),
  report_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  //report_file_name: z.string().min(1),
  //report_out_mode: z.enum(['file', 'print']),
  //barcode: z.string().optional() // ✅ este es el cambio
});

// Main ZPL request schema
export const zplRequestSchema = z.object({
  core_report_info: coreReportInfoSchema
}).passthrough(); // allow additional properties


