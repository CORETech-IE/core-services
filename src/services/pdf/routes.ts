import express from 'express';
import { generatePDF } from './generate';
import { pdfRequestSchema } from '../../validators/pdfRequestSchema';
import { validateBody } from '../../middlewares/validateBody';

const router = express.Router();

/**
 * POST /pdf
 * Accepts JSON with core_report_info and other dynamic data.
 * Returns a generated PDF document as binary.
 */
router.post('/', validateBody(pdfRequestSchema), async (req, res, next) => {
  try {
    const data = req.body;
    const info = data.core_report_info;

    const buffer = await generatePDF(data);
    const filename = info.report_file_name || 'report.pdf';

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${filename}`,
      'Content-Length': buffer.length
    });

    return res.end(buffer);
  } catch (error) {
    return next(error);
  }
});

export default router;
