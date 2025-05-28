import express from 'express';
import { sendEmail } from './send';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const result = await sendEmail(req.body);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send email' });
  }
});

export default router;
