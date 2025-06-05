/**
 * 🔧 CORE-SERVICES: Logger Configuration
 * 
 * Configuration utilities and helpers for the logging system
 * Centralized configuration logic following SOLID principles
 * 
 * Classification: INTERNAL (service infrastructure)
 */

import path from 'path';
import fs from 'fs';
import { LogMode, LogLevel, LoggerConfig } from './types';

/**
 * Sensitive field patterns for data sanitization
 * More specific to core-services operations
 */
export const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /auth/i,
  /credential/i,
  /private/i,
  /email/i,
  /mail/i,
  /recipient/i,
  /sender/i,
  /subject/i,
  /body/i,
  /content/i,
  /payload/i,
  /data/i
];

/**
 * Determine log mode from environment
 */
export const getLogMode = (): LogMode => {
  const mode = process.env.LOG_LEVEL?.toLowerCase();
  return (mode === 'verbose' || mode === 'debug') ? 'verbose' : 'normal';
};

/**
 * Get effective log level based on mode and environment
 */
export const getLogLevel = (): LogLevel => {
  const mode = getLogMode();
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  
  if (mode === 'verbose') {
    return 'DEBUG';
  }
  
  // Normal mode levels
  const validLevels: LogLevel[] = ['INFO', 'WARN', 'ERROR'];
  if (envLevel && validLevels.includes(envLevel as LogLevel)) {
    return envLevel as LogLevel;
  }
  
  return process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG';
};

/**
 * Get service name from environment or default
 */
export const getServiceName = (): string => {
  return process.env.SERVICE_NAME || 'core-services';
};

/**
 * Get environment name
 */
export const getEnvironment = (): string => {
  return process.env.NODE_ENV || 'development';
};

/**
 * Create logs directory lazily and safely
 */
export const ensureLogsDirectory = (): string => {
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  return logsDir;
};

/**
 * Create complete logger configuration
 */
export const createLoggerConfig = (): LoggerConfig => {
  return {
    mode: getLogMode(),
    level: getLogLevel(),
    environment: getEnvironment(),
    service: getServiceName(),
    logsDirectory: ensureLogsDirectory()
  };
};

/**
 * Sanitize sensitive data based on log mode
 * Single Responsibility: Only handles data sanitization
 */
export const sanitizeLogData = (data: any, mode: LogMode): any => {
  // In verbose mode, don't sanitize anything
  if (mode === 'verbose') {
    return data;
  }
  
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeLogData(item, mode));
  }
  
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(data)) {
    const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value, mode);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

/**
 * Format uptime to human readable string
 */
export const formatUptime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

/**
 * Validate log level
 */
export const isValidLogLevel = (level: string): level is LogLevel => {
  const validLevels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
  return validLevels.includes(level as LogLevel);
};

/**
 * Validate service operation
 */
export const isValidServiceOperation = (operation: string): boolean => {
  const validOperations = [
    'PDF_GENERATION',
    'ZPL_GENERATION', 
    'EMAIL_OPERATION',
    'SERVICE_CONTAINER',
    'AUTHENTICATION',
    'SYSTEM',
    'API_REQUEST'
  ];
  return validOperations.includes(operation);
};

/**
 * Default logger metadata
 */
export const getDefaultMeta = (config: LoggerConfig) => {
  return {
    service: config.service,
    environment: config.environment,
    mode: config.mode
  };
};