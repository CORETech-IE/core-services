import express from 'express';
import { generateZPL } from './generate';
import { zplRequestSchema } from '../../validators/zplRequestSchema';
import { validateBody } from '../../middlewares/validateBody';

const router = express.Router();

/**
 * POST /zpl
 * Accepts JSON with core_report_info and other dynamic data.
 * Returns a generated ZPL string as a plain text file.
 */
router.post('/', validateBody(zplRequestSchema), async (req, res, next) => {
  try {
    const data = req.body;
    const zpl = await generateZPL(data);

    res.set({
      'Content-Type': 'text/plain',
      'Content-Disposition': 'attachment; filename=etiquetas.zpl.txt',
      'Content-Length': Buffer.byteLength(zpl),
    });

    return res.end(zpl);
  } catch (error) {
    return next(error);
  }
});

export default router;
