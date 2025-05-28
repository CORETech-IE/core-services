import express from 'express';
import { generatePDF } from './generate';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const buffer = await generatePDF(req.body);
    res.contentType('application/pdf');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
