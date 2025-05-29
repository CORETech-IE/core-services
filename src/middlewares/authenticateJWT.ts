import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import envConfig from '../config/envConfig';

export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const user = jwt.verify(token, envConfig.jwtSecret);
    (req as any).user = user;
    next();
  } catch {
    res.status(403).json({ message: 'Token verification failed' });
  }
}
