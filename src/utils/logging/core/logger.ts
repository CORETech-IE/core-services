/**
 * 🔧 CORE-SERVICES: Core Logger
 * 
 * Base logger implementation with core functionality
 * Follows SOLID principles with single responsibility
 * 
 * Classification: INTERNAL (service infrastructure)
 */

import { Logger } from 'winston';
import { 
  LogLevel, 
  ServiceOperation, 
  CoreServicesLogEntry, 
  ILogger, 
  ICoreServicesLogger,
  LoggerConfig 
} from './types';

/**
 * Base CoreServices Logger Class
 * Single Responsibility: Core logging functionality
 */
export class CoreServicesLogger implements ICoreServicesLogger {
  protected logger: Logger;
  protected config: LoggerConfig;
  
  constructor(logger: Logger, config: LoggerConfig) {
    this.logger = logger;
    this.config = config;
  }
  
  /**
   * Debug logging (verbose mode only)
   */
  debug(message: string, meta?: Partial<CoreServicesLogEntry>): void {
    this.log('DEBUG', message, meta);
  }
  
  /**
   * Info logging
   */
  info(message: string, meta?: Partial<CoreServicesLogEntry>): void {
    this.log('INFO', message, meta);
  }
  
  /**
   * Warning logging
   */
  warn(message: string, meta?: Partial<CoreServicesLogEntry>): void {
    this.log('WARN', message, meta);
  }
  
  /**
   * Error logging
   */
  error(message: string, meta?: Partial<CoreServicesLogEntry>): void {
    this.log('ERROR', message, meta);
  }
  
  /**
   * PDF generation logging
   */
  pdf(message: string, meta?: Partial<CoreServicesLogEntry>): void {
    this.log('INFO', message, {
      ...meta,
      operation: 'PDF_GENERATION'
    });
  }
  
  /**
   * ZPL label generation logging
   */
  zpl(message: string, meta?: Partial<CoreServicesLogEntry>): void {
    this.log('INFO', message, {
      ...meta,
      operation: 'ZPL_GENERATION'
    });
  }
  
  /**
   * Email operation logging
   */
  email(message: string, meta?: Partial<CoreServicesLogEntry>): void {
    this.log('INFO', message, {
      ...meta,
      operation: 'EMAIL_OPERATION'
    });
  }
  
  /**
   * Service container logging
   */
  container(message: string, meta?: Partial<CoreServicesLogEntry>): void {
    this.log('INFO', message, {
      ...meta,
      operation: 'SERVICE_CONTAINER'
    });
  }
  
  /**
   * Authentication logging
   */
  auth(message: string, meta?: Partial<CoreServicesLogEntry>): void {
    this.log('INFO', message, {
      ...meta,
      operation: 'AUTHENTICATION'
    });
  }
  
  /**
   * API request logging
   */
  request(message: string, meta?: Partial<CoreServicesLogEntry>): void {
    this.log('INFO', message, {
      ...meta,
      operation: 'API_REQUEST'
    });
  }
  
  /**
   * System operation logging
   */
  system(message: string, meta?: Partial<CoreServicesLogEntry>): void {
    this.log('INFO', message, {
      ...meta,
      operation: 'SYSTEM'
    });
  }
  
  /**
   * Performance logging with automatic duration calculation
   */
  performance(operation: ServiceOperation, startTime: number, meta?: Partial<CoreServicesLogEntry>): void {
    const duration = Date.now() - startTime;
    this.log('INFO', `${operation} completed`, {
      ...meta,
      operation,
      duration_ms: duration
    });
  }
  
  /**
   * Create child logger with default metadata
   */
  child(defaultMeta: Partial<CoreServicesLogEntry>): ICoreServicesLogger {
    const childLogger = this.logger.child(defaultMeta);
    return new CoreServicesLogger(childLogger, this.config);
  }
  
  /**
   * Check if current mode is verbose
   */
  isVerbose(): boolean {
    return this.config.mode === 'verbose';
  }
  
  /**
   * Core logging method - PROTECTED so subclasses can access it
   * This fixes the "Property 'log' is private" error
   */
  protected log(level: LogLevel, message: string, meta?: Partial<CoreServicesLogEntry>): void {
    this.logger.log(level, message, meta);
  }
  
  /**
   * Get logger configuration
   */
  getConfig(): LoggerConfig {
    return this.config;
  }
  
  /**
   * Get underlying Winston logger (for advanced usage)
   */
  getWinstonLogger(): Logger {
    return this.logger;
  }
}