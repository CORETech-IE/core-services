import axios from "axios";
import { getServiceContainer } from "./serviceContainer";
import { getAuthToken } from "../utils/getToken";
import logger from "../utils/logging";

export interface LogPayload {
  level: "INFO" | "ERROR" | "WARN" | "DEBUG" | "TRACE" | "FATAL" | "CRITICAL" | "ALERT" | "EMERGENCY" | "NOTICE" | "AUDIT";
  message: string;
  service: string; // name of the service emitting the log
  metadata?: Record<string, any>;
  trace_id?: string; // optional trace ID for distributed tracing
}

/**
 * Send log to centralized logging system
 * 
 * Note: This is a legacy function that was used before implementing
 * the nuclear logger system. It's maintained for backward compatibility
 * but should be phased out in favor of the structured logger.
 * 
 * @param log - Log payload to send
 * @deprecated Use the nuclear logger system instead: import logger from '../utils/logging'
 */
export async function sendLog(log: LogPayload): Promise<void> {
  const startTime = Date.now();
  
  try {
    logger.debug('Legacy log emitter called', {
      operation: 'SYSTEM',
      service: log.service,
      level: log.level,
      message_preview: log.message.substring(0, 50),
      has_metadata: !!log.metadata,
      has_trace_id: !!log.trace_id,
      deprecated_warning: 'Consider migrating to nuclear logger system'
    });

    if (!log.service) {
      logger.warn('Legacy log emitter missing service field', {
        operation: 'SYSTEM',
        error_code: 'MISSING_SERVICE_FIELD',
        log_level: log.level,
        duration_ms: Date.now() - startTime
      });
      throw new Error("Missing 'service' in log payload");
    }

    // Check if we have the required configuration
    const container = getServiceContainer();
    const tokenConfig = container.getTokenConfig();
    
    // TODO: This function needs proper API URL configuration
    // For now, we'll log the attempt but not actually send
    const payload = {
      client_id: tokenConfig.tenantId,
      timestamp: new Date().toISOString(),
      ...log,
    };

    logger.debug('Legacy log emitter payload prepared', {
      operation: 'SYSTEM',
      client_id: tokenConfig.tenantId,
      service: log.service,
      level: log.level,
      payload_size: JSON.stringify(payload).length,
      duration_ms: Date.now() - startTime,
      status: 'DISABLED_NO_API_URL',
      note: 'Central logging endpoint not configured'
    });

    // REMOVED: Ugly console.log statements
    // These were polluting the logs with debugging info
    
    // TODO: Implement actual sending when API URL is configured
    // const token = await getAuthToken();
    // await axios.post(`${apiUrl}/emit-log`, payload, {
    //   headers: {
    //     Authorization: `Bearer ${token}`,
    //   },
    // });
    
    logger.debug('Legacy log emitter completed', {
      operation: 'SYSTEM',
      service: log.service,
      duration_ms: Date.now() - startTime,
      status: 'SIMULATED_SUCCESS',
      recommendation: 'Migrate to logger.pdf(), logger.email(), logger.zpl() methods'
    });

  } catch (err: any) {
    logger.error('Legacy log emitter failed', {
      operation: 'SYSTEM',
      error_code: 'LOG_EMIT_ERROR',
      error_message: err.message,
      service: log?.service || 'UNKNOWN',
      duration_ms: Date.now() - startTime,
      stack: err.stack
    });
  }
}

/**
 * Migration helper: Convert legacy log to nuclear logger call
 * 
 * This function helps migrate from legacy sendLog() calls to the new logger system
 * Usage: migrateLegacyLog({ service: 'pdf', level: 'INFO', message: 'PDF generated' })
 * 
 * @param log - Legacy log payload
 */
export function migrateLegacyLog(log: LogPayload): void {
  const meta = {
    trace_id: log.trace_id,
    legacy_service: log.service,
    legacy_level: log.level,
    ...(log.metadata || {})
  };

  switch (log.service.toLowerCase()) {
    case 'pdf':
      if (log.level === 'ERROR') {
        logger.pdf(`Legacy: ${log.message}`, meta);
      } else {
        logger.pdf(`Legacy: ${log.message}`, meta);
      }
      break;
      
    case 'zpl':
      if (log.level === 'ERROR') {
        logger.zpl(`Legacy: ${log.message}`, meta);
      } else {
        logger.zpl(`Legacy: ${log.message}`, meta);
      }
      break;
      
    case 'email':
      if (log.level === 'ERROR') {
        logger.email(`Legacy: ${log.message}`, meta);
      } else {
        logger.email(`Legacy: ${log.message}`, meta);
      }
      break;
      
    default:
      if (log.level === 'ERROR') {
        logger.error(`Legacy ${log.service}: ${log.message}`, meta);
      } else {
        logger.info(`Legacy ${log.service}: ${log.message}`, meta);
      }
  }
}

/**
 * Check if central logging endpoint is configured
 * 
 * @returns true if ready to send to central logging system
 */
export function isCentralLoggingAvailable(): boolean {
  // TODO: Implement when API URL configuration is added to ServiceContainer
  return false;
}

/**
 * Get the configured central logging endpoint URL
 * 
 * @returns URL string or null if not configured
 */
export function getCentralLoggingUrl(): string | null {
  // TODO: Implement when API URL configuration is added to ServiceContainer
  return null;
}