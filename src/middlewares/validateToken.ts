import { Request, Response, NextFunction } from 'express';
import { getInternalToken } from '../config/internalToken';

export function validateToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const expectedToken = getInternalToken();

  if (token !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}
