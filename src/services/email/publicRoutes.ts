// src/services/email/publicRoutes.ts

import express from 'express';
import { abacSend } from '../../controllers/email/abacSend';

const router = express.Router();

// No requiere JWT, solo gdpr_token
router.post('/send-with-consent', abacSend);

export default router;
