import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function traceId(req: Request, res: Response, next: NextFunction) {
  const incomingTraceId = req.headers['x-trace-id'] as string;
  const newTraceId = incomingTraceId || uuidv4();
  (req as any).trace_id = newTraceId;
  res.setHeader('x-trace-id', newTraceId);
  next();
}
