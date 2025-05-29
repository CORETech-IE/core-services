import { Request, Response, NextFunction } from 'express';

export function allowGetPostOnly(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  next();
}
