import express from 'express';
import { generateZPL } from './generate';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const zpl = await generateZPL(req.body);
    res.type('text/plain').send(zpl);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate ZPL' });
  }
});

export default router;