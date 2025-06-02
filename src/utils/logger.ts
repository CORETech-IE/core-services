// src/utils/logger.ts

import { createLogger, format, transports } from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logDir = path.resolve(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

export const logger = createLogger({
  level: 'info', // Can be overridden with process.env.LOG_LEVEL
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: {
    service: 'core-services',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console for devs
    new transports.Console({
      level: process.env.LOG_LEVEL || 'info'
    }),

    // File for audit and postmortem analysis
    new transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5
    }),

    new transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  ],
  exitOnError: false
});
