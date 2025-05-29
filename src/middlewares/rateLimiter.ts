import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100,             // 100 peticiones por minuto
  standardHeaders: true,
  legacyHeaders: false
});
