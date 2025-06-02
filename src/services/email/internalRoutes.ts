import express from 'express';
import { sendEmail } from './emailService';
import { authenticateJWT, authorizeAdmin } from '../../middlewares';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

router.post(
  '/send-internal',
  authenticateJWT,
  authorizeAdmin,
  async (req, res) => {
    const trace_id = uuidv4(); // Generate a unique trace ID for this request

    try {
      const result = await sendEmail(req.body, trace_id);
      res.json({ success: true, trace_id, result });
    } catch (err) {
      res.status(500).json({ error: 'Failed to send email', trace_id });
    }
  }
);

export default router;
