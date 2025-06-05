/**
 * 🔧 CORE-SERVICES: Logger Types
 * 
 * Core types and interfaces for the logging system
 * Centralized type definitions following SOLID principles
 * 
 * Classification: INTERNAL (service infrastructure)
 */

/**
 * Log levels for core-services operations - Extended for legacy compatibility
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'TRACE' | 'FATAL' | 'CRITICAL' | 'ALERT' | 'EMERGENCY' | 'NOTICE' | 'AUDIT';

/**
 * Core-services specific log categories
 */
export type ServiceOperation = 
  | 'PDF_GENERATION' 
  | 'ZPL_GENERATION' 
  | 'EMAIL_OPERATION' 
  | 'SERVICE_CONTAINER' 
  | 'AUTHENTICATION' 
  | 'SYSTEM' 
  | 'API_REQUEST';

/**
 * Log modes for data sensitivity
 */
export type LogMode = 'normal' | 'verbose';

/**
 * Structured log entry interface
 */
export interface CoreServicesLogEntry {
  // Core message
  message: string;
  level?: LogLevel;
  
  // Service-specific context
  operation?: ServiceOperation;
  correlation_id?: string;
  trace_id?: string;
  
  // Performance metrics
  duration_ms?: number;
  file_size_bytes?: number;
  
  // Business context
  client_name?: string;
  user_id?: string;
  request_id?: string;
  
  // Technical context
  error_code?: string;
  stack?: string;
  endpoint?: string;
  method?: string;
  status_code?: number;
  
  // Service-specific data
  pdf_pages?: number;
  zpl_labels?: number;
  email_recipients?: number;
  attachment_count?: number;
  
  // Additional data (will be sanitized in normal mode)
  [key: string]: any;
}

/**
 * System metrics interface for performance monitoring
 */
export interface SystemMetrics {
  timestamp: string;
  memory: {
    rss: number;           // Resident Set Size (bytes)
    heapTotal: number;     // Total heap (bytes)
    heapUsed: number;      // Used heap (bytes)
    external: number;      // External memory (bytes)
    arrayBuffers: number;  // ArrayBuffers (bytes)
  };
  cpu: {
    userCPUTime: number;   // User CPU time (microseconds)
    systemCPUTime: number; // System CPU time (microseconds)
    cpuUsagePercent?: number; // CPU usage percentage (calculated)
  };
  process: {
    pid: number;
    ppid: number;
    uptime: number;        // Process uptime (seconds)
    uptimeFormatted: string; // Human readable uptime
    platform: string;
    nodeVersion: string;
  };
  system?: {
    totalMemory?: number;  // Total system memory (bytes)
    freeMemory?: number;   // Free system memory (bytes)
    loadAverage?: number[]; // Load average (Unix-like systems)
    cpuCount?: number;     // Number of CPU cores
  };
  gc?: {
    heapSizeLimit: number;
    totalHeapSizeExecutable: number;
    usedHeapSize: number;
  };
}

/**
 * Daily statistics interface for business metrics
 */
export interface DailyStats {
  date: string;
  period: {
    start: string;
    end: string;
  };
  operations: {
    emails_sent: number;
    emails_failed: number;
    pdfs_generated: number;
    pdfs_failed: number;
    zpl_labels_generated: number;
    zpl_labels_failed: number;
    total_requests: number;
    failed_requests: number;
  };
  performance: {
    avg_email_duration_ms: number;
    avg_pdf_duration_ms: number;
    avg_zpl_duration_ms: number;
    peak_memory_mb: number;
    avg_cpu_percent: number;
    max_concurrent_operations: number;
  };
  errors: {
    authentication_failures: number;
    service_errors: number;
    system_errors: number;
    total_errors: number;
  };
  system: {
    restarts: number;
    uptime_hours: number;
    total_uptime_hours: number;
  };
}

/**
 * Error types for statistics categorization
 */
export type ErrorType = 'auth' | 'service' | 'system';

/**
 * Logger configuration interface
 */
export interface LoggerConfig {
  mode: LogMode;
  level: LogLevel;
  environment: string;
  service: string;
  logsDirectory: string;
}

/**
 * Base logger interface for core functionality
 */
export interface ILogger {
  debug(message: string, meta?: Partial<CoreServicesLogEntry>): void;
  info(message: string, meta?: Partial<CoreServicesLogEntry>): void;
  warn(message: string, meta?: Partial<CoreServicesLogEntry>): void;
  error(message: string, meta?: Partial<CoreServicesLogEntry>): void;
  isVerbose(): boolean;
  child(defaultMeta: Partial<CoreServicesLogEntry>): ILogger;
}

/**
 * Enhanced logger interface with service-specific methods
 */
export interface ICoreServicesLogger extends ILogger {
  // Service-specific logging methods
  pdf(message: string, meta?: Partial<CoreServicesLogEntry>): void;
  zpl(message: string, meta?: Partial<CoreServicesLogEntry>): void;
  email(message: string, meta?: Partial<CoreServicesLogEntry>): void;
  container(message: string, meta?: Partial<CoreServicesLogEntry>): void;
  auth(message: string, meta?: Partial<CoreServicesLogEntry>): void;
  request(message: string, meta?: Partial<CoreServicesLogEntry>): void;
  system(message: string, meta?: Partial<CoreServicesLogEntry>): void;
  
  // Performance logging
  performance(operation: ServiceOperation, startTime: number, meta?: Partial<CoreServicesLogEntry>): void;
}

/**
 * Metrics collector interface
 */
export interface IMetricsCollector {
  collectMetrics(): SystemMetrics;
  logMetrics(): void;
  startMetricsCollection(intervalMs?: number): void;
  stopMetricsCollection(): void;
  getMetricsSummary(): string;
}

/**
 * Daily stats collector interface
 */
export interface IDailyStatsCollector {
  recordEmail(success: boolean, durationMs?: number): void;
  recordPdf(success: boolean, durationMs?: number): void;
  recordZpl(success: boolean, durationMs?: number): void;
  recordError(type: ErrorType): void;
  updatePerformanceMetrics(memoryMB: number, cpuPercent?: number): void;
  startOperation(): void;
  endOperation(): void;
  getDailySummary(stats?: DailyStats): string;
  getCurrentStats(): DailyStats;
  startDailyStats(): void;
  stopDailyStats(): void;
}

/**
 * Enhanced logger interface with metrics and stats
 */
export interface IEnhancedLogger extends ICoreServicesLogger {
  metrics: IMetricsCollector;
  dailyStats: IDailyStatsCollector;
  
  // System metrics
  systemMetrics(message: string, meta?: Partial<CoreServicesLogEntry>): void;
  
  // Lifecycle methods
  startMetrics(intervalMs?: number): void;
  stopMetrics(): void;
  
  // Daily stats methods
  getDailySummary(): string;
  getCurrentDailyStats(): DailyStats;
}