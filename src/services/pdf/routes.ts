import express from 'express';
import { generatePDF } from './generate';

const router = express.Router();

/**
 * POST /pdf
 * Accepts JSON with core_report_info and other dynamic data.
 * Returns a generated PDF document as binary.
 */
router.post('/', async (req, res, next) => {
  try {
    const data = req.body;

    const info = data?.core_report_info;
    if (!info || !info.report_template) {
      return res.status(400).json({ message: 'Missing core_report_info or report_template' });
    }

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
