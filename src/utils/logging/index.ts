/**
 * 🚀 CORE-SERVICES: Logger System
 * 
 * Clean barrel exports for the logging system
 * Provides clean imports following SOLID principles
 * 
 * Classification: INTERNAL (service infrastructure)
 * 
 * Usage:
 * import logger from '@/utils/logging';
 * import { CoreServicesLogger, LogLevel } from '@/utils/logging';
 */

// Re-export all types for clean imports
export type {
  LogLevel,
  ServiceOperation,
  LogMode,
  CoreServicesLogEntry,
  SystemMetrics,
  DailyStats,
  ErrorType,
  LoggerConfig,
  ILogger,
  ICoreServicesLogger,
  IMetricsCollector,
  IDailyStatsCollector,
  IEnhancedLogger
} from './core/types';

// Re-export configuration utilities
export {
  getLogMode,
  getLogLevel,
  getServiceName,
  getEnvironment,
  ensureLogsDirectory,
  createLoggerConfig,
  sanitizeLogData,
  formatUptime,
  isValidLogLevel,
  isValidServiceOperation,
  getDefaultMeta,
  SENSITIVE_PATTERNS
} from './core/config';

// Re-export core logger class
export { CoreServicesLogger } from './core/logger';

// Import human-friendly formatters
import { 
  createHumanMetricsSummary, 
  createDetailedHumanMetrics, 
  createConsoleMetrics 
} from './formatter/humanMetrics';

// TODO: Import collectors when created  
// export { MetricsCollector } from './collectors/metricsCollector';
// export { DailyStatsCollector } from './collectors/dailyStatsCollector';

// TODO: Import enhanced logger when created
// export { EnhancedCoreServicesLogger } from './enhancedLogger';

// Temporary implementation for current compatibility
// This will be replaced when we move formatters and collectors to separate files
import { createLogger, format, transports, Logger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { 
  createLoggerConfig, 
  sanitizeLogData, 
  getDefaultMeta,
  formatUptime 
} from './core/config';
import { 
  CoreServicesLogEntry, 
  SystemMetrics, 
  DailyStats, 
  IEnhancedLogger,
  IMetricsCollector,
  IDailyStatsCollector,
  ErrorType 
} from './core/types';
import { CoreServicesLogger } from './core/logger';
import path from 'path';

// Temporary formatters (will be moved to separate files)
const createStructuredFormat = () => {
  return format.printf((info) => {
    const config = createLoggerConfig();
    const {
      timestamp,
      level,
      message,
      operation,
      correlation_id,
      service = config.service,
      environment = config.environment,
      ...meta
    } = info;
    
    const sanitizedMeta = sanitizeLogData(meta, config.mode);
    
    const logEntry: any = {
      timestamp,
      level: level.toUpperCase(),
      service,
      environment,
      mode: config.mode,
      message
    };
    
    if (operation) {
      logEntry.operation = operation;
    }
    
    if (correlation_id) {
      logEntry.correlation_id = correlation_id;
    }
    
    if (Object.keys(sanitizedMeta).length > 0) {
      logEntry.metadata = sanitizedMeta;
    }
    
    return JSON.stringify(logEntry);
  });
};

const createConsoleFormat = () => {
  return format.printf((info) => {
    const config = createLoggerConfig();
    const {
      timestamp,
      level,
      message,
      operation,
      correlation_id,
      duration_ms,
      ...meta
    } = info;
    
    let output = `${timestamp} [${level.toUpperCase()}]`;
    
    if (config.mode === 'verbose') {
      output += ` [VERBOSE]`;
    }
    
    if (operation) {
      output += ` [${operation}]`;
    }
    
    if (correlation_id && typeof correlation_id === 'string') {
      output += ` [${correlation_id.substring(0, 8)}...]`;
    }
    
    output += `: ${message}`;
    
    if (duration_ms) {
      output += ` (${duration_ms}ms)`;
    }
    
    const sanitizedMeta = sanitizeLogData(meta, config.mode);
    if (config.mode === 'verbose' || level === 'error') {
      if (Object.keys(sanitizedMeta).length > 0) {
        output += `\n  📋 ${JSON.stringify(sanitizedMeta, null, 2)}`;
      }
    }
    
    return output;
  });
};

// Temporary collectors (will be moved to separate files)
class TempMetricsCollector implements IMetricsCollector {
  private previousCPUUsage: NodeJS.CpuUsage | null = null;
  private previousTimestamp: number | null = null;
  private metricsLogger: Logger;
  private intervalId: NodeJS.Timeout | null = null;
  private dailyStats: TempDailyStatsCollector;
  
  constructor(config: any, dailyStats: TempDailyStatsCollector) {
    this.dailyStats = dailyStats;
    this.metricsLogger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        format.printf((info) => JSON.stringify(info))
      ),
      transports: [
        new DailyRotateFile({
          filename: path.join(config.logsDirectory, 'core-services-metrics-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '25m',
          maxFiles: '30d',
          level: 'info'
        })
      ],
      exitOnError: false
    });
  }
  
  collectMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const currentTime = Date.now();
    
    let cpuUsagePercent: number | undefined;
    if (this.previousCPUUsage && this.previousTimestamp) {
      const timeDiff = currentTime - this.previousTimestamp;
      const userDiff = cpuUsage.user - this.previousCPUUsage.user;
      const systemDiff = cpuUsage.system - this.previousCPUUsage.system;
      const totalCPUTime = (userDiff + systemDiff) / 1000;
      cpuUsagePercent = Math.min(100, (totalCPUTime / timeDiff) * 100);
    }
    
    this.previousCPUUsage = cpuUsage;
    this.previousTimestamp = currentTime;
    
    const uptimeSeconds = process.uptime();
    
    return {
      timestamp: new Date().toISOString(),
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers
      },
      cpu: {
        userCPUTime: cpuUsage.user,
        systemCPUTime: cpuUsage.system,
        ...(cpuUsagePercent !== undefined && { cpuUsagePercent })
      },
      process: {
        pid: process.pid,
        ppid: process.ppid || 0,
        uptime: uptimeSeconds,
        uptimeFormatted: formatUptime(uptimeSeconds),
        platform: process.platform,
        nodeVersion: process.version
      }
    };
  }
  
  /**
   * Log current metrics and update daily stats - NOW WITH HUMAN-FRIENDLY FORMAT!
   */
  logMetrics(): void {
    const metrics = this.collectMetrics();
    
    // Human-friendly version for log file
    const humanMetrics = createDetailedHumanMetrics(metrics);
    this.metricsLogger.info('SYSTEM_METRICS', humanMetrics);
    
    // Update daily stats with performance data
    const memoryMB = Math.round(metrics.memory.heapUsed / 1024 / 1024);
    this.dailyStats.updatePerformanceMetrics(memoryMB, metrics.cpu.cpuUsagePercent);
  }
  
  startMetricsCollection(intervalMs: number = 30000): void {
    if (this.intervalId) return;
    this.logMetrics();
    this.intervalId = setInterval(() => this.logMetrics(), intervalMs);
  }
  
  stopMetricsCollection(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  /**
   * Get human-readable metrics summary with emojis and proper units
   */
  getMetricsSummary(): string {
    const metrics = this.collectMetrics();
    return createConsoleMetrics(metrics);
  }
}

class TempDailyStatsCollector implements IDailyStatsCollector {
  private currentStats: DailyStats;
  
  constructor() {
    this.currentStats = this.initializeStats();
  }
  
  private initializeStats(): DailyStats {
    const now = new Date();
    return {
      date: now.toISOString().split('T')[0],
      period: { start: now.toISOString(), end: '' },
      operations: {
        emails_sent: 0, emails_failed: 0, pdfs_generated: 0, pdfs_failed: 0,
        zpl_labels_generated: 0, zpl_labels_failed: 0, total_requests: 0, failed_requests: 0
      },
      performance: {
        avg_email_duration_ms: 0, avg_pdf_duration_ms: 0, avg_zpl_duration_ms: 0,
        peak_memory_mb: 0, avg_cpu_percent: 0, max_concurrent_operations: 0
      },
      errors: { authentication_failures: 0, service_errors: 0, system_errors: 0, total_errors: 0 },
      system: { restarts: 0, uptime_hours: 0, total_uptime_hours: 0 }
    };
  }
  
  recordEmail(success: boolean, durationMs?: number): void {
    if (success) this.currentStats.operations.emails_sent++;
    else this.currentStats.operations.emails_failed++;
    this.currentStats.operations.total_requests++;
  }
  
  recordPdf(success: boolean, durationMs?: number): void {
    if (success) this.currentStats.operations.pdfs_generated++;
    else this.currentStats.operations.pdfs_failed++;
    this.currentStats.operations.total_requests++;
  }
  
  recordZpl(success: boolean, durationMs?: number): void {
    if (success) this.currentStats.operations.zpl_labels_generated++;
    else this.currentStats.operations.zpl_labels_failed++;
    this.currentStats.operations.total_requests++;
  }
  
  recordError(type: ErrorType): void {
    switch (type) {
      case 'auth': this.currentStats.errors.authentication_failures++; break;
      case 'service': this.currentStats.errors.service_errors++; break;
      case 'system': this.currentStats.errors.system_errors++; break;
    }
    this.currentStats.errors.total_errors++;
  }
  
  updatePerformanceMetrics(memoryMB: number, cpuPercent?: number): void {
    this.currentStats.performance.peak_memory_mb = Math.max(
      this.currentStats.performance.peak_memory_mb, memoryMB
    );
  }
  
  startOperation(): void {}
  endOperation(): void {}
  
  getDailySummary(): string {
    const s = this.currentStats;
    return `Emails: ${s.operations.emails_sent}, PDFs: ${s.operations.pdfs_generated}, ` +
           `ZPL: ${s.operations.zpl_labels_generated}, Errors: ${s.errors.total_errors}`;
  }
  
  getCurrentStats(): DailyStats { return this.currentStats; }
  startDailyStats(): void {}
  stopDailyStats(): void {}
}

// Enhanced logger with temporary implementation
class TempEnhancedLogger extends CoreServicesLogger implements IEnhancedLogger {
  public metrics: IMetricsCollector;
  public dailyStats: TempDailyStatsCollector;
  
  constructor(logger: Logger, config: any) {
    super(logger, config);
    this.dailyStats = new TempDailyStatsCollector();
    this.metrics = new TempMetricsCollector(config, this.dailyStats);
  }
  
  systemMetrics(message: string, meta?: Partial<CoreServicesLogEntry>): void {
    const summary = this.metrics.getMetricsSummary();
    this.system(`${message} - ${summary}`, meta);
  }
  
  startMetrics(intervalMs: number = 30000): void {
    this.metrics.startMetricsCollection(intervalMs);
    this.dailyStats.startDailyStats();
  }
  
  stopMetrics(): void {
    this.metrics.stopMetricsCollection();
    this.dailyStats.stopDailyStats();
  }
  
  getDailySummary(): string {
    return this.dailyStats.getDailySummary();
  }
  
  getCurrentDailyStats(): DailyStats {
    return this.dailyStats.getCurrentStats();
  }
  
  // Override methods to include stats tracking
  pdf(message: string, meta?: Partial<CoreServicesLogEntry>): void {
    const success = !message.toLowerCase().includes('error') && !message.toLowerCase().includes('failed');
    this.dailyStats.recordPdf(success, meta?.duration_ms);
    super.pdf(message, meta);
  }
  
  email(message: string, meta?: Partial<CoreServicesLogEntry>): void {
    const success = !message.toLowerCase().includes('error') && !message.toLowerCase().includes('failed');
    this.dailyStats.recordEmail(success, meta?.duration_ms);
    super.email(message, meta);
  }
  
  zpl(message: string, meta?: Partial<CoreServicesLogEntry>): void {
    const success = !message.toLowerCase().includes('error') && !message.toLowerCase().includes('failed');
    this.dailyStats.recordZpl(success, meta?.duration_ms);
    super.zpl(message, meta);
  }
  
  error(message: string, meta?: Partial<CoreServicesLogEntry>): void {
    const operation = meta?.operation;
    if (operation === 'AUTHENTICATION') {
      this.dailyStats.recordError('auth');
    } else if (operation && ['PDF_GENERATION', 'ZPL_GENERATION', 'EMAIL_OPERATION'].includes(operation)) {
      this.dailyStats.recordError('service');
    } else {
      this.dailyStats.recordError('system');
    }
    super.error(message, meta);
  }
}

// Create the Winston logger
const createWinstonLogger = (): Logger => {
  const config = createLoggerConfig();
  
  return createLogger({
    level: config.level,
    format: format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      format.errors({ stack: true }),
      createStructuredFormat()
    ),
    defaultMeta: getDefaultMeta(config),
    transports: [
      new transports.Console({
        level: config.level,
        format: format.combine(
          format.colorize({
            colors: { debug: 'blue', info: 'green', warn: 'yellow', error: 'red' }
          }),
          format.timestamp({ format: 'HH:mm:ss.SSS' }),
          createConsoleFormat()
        )
      }),
      new DailyRotateFile({
        filename: path.join(config.logsDirectory, 'core-services-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '50m',
        maxFiles: '14d',
        level: 'info'
      }),
      new DailyRotateFile({
        filename: path.join(config.logsDirectory, 'core-services-error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '25m',
        maxFiles: '30d',
        level: 'error'
      })
    ],
    exceptionHandlers: [
      new DailyRotateFile({
        filename: path.join(config.logsDirectory, 'core-services-exceptions-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '25m',
        maxFiles: '30d'
      })
    ],
    rejectionHandlers: [
      new DailyRotateFile({
        filename: path.join(config.logsDirectory, 'core-services-rejections-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '25m',
        maxFiles: '30d'
      })
    ],
    exitOnError: false
  });
};

// Create and export the default logger instance
const winstonLogger = createWinstonLogger();
const config = createLoggerConfig();
const logger = new TempEnhancedLogger(winstonLogger, config);

// Log successful initialization
logger.systemMetrics('🚀 Core-Services logger system initialized', {
  mode: config.mode,
  log_level: config.level,
  environment: config.environment,
  verbose_enabled: logger.isVerbose(),
  daily_summary: logger.getDailySummary()
});

// Export the configured logger as default
export default logger;

// Export the enhanced logger class for direct instantiation
export { TempEnhancedLogger as EnhancedCoreServicesLogger };