import axios from "axios";
import { getServiceContainer } from "./serviceContainer";
import { getAuthToken } from "../utils/getToken";

export interface LogPayload {
  level: "INFO" | "ERROR" | "WARN" | "DEBUG" | "TRACE" | "FATAL" | "CRITICAL" | "ALERT" | "EMERGENCY" | "NOTICE" | "AUDIT";
  message: string;
  service: string; //name of the service emitting the log
  metadata?: Record<string, any>;
  trace_id?: string; //optional trace ID for distributed tracing
}

export async function sendLog(log: LogPayload) {
  try {
    const token = await getAuthToken();
    
    if (!log.service) {
      throw new Error("Missing 'service' in log payload");
    }

    // Get config from service container
    const container = getServiceContainer();
    const tokenConfig = container.getTokenConfig();
    
    // Note: We need tenantClientId and apiUrl from the main config
    // For now, let's add these to the service container
    // TODO: Add getLogConfig() method to ServiceContainer
    
    const payload = {
      client_id: tokenConfig.tenantId, // Using tenantId as fallback for tenantClientId
      timestamp: new Date().toISOString(),
      ...log,
    };

    // TODO: We need apiUrl from the container too
    // For now, this will fail gracefully until we add it to ServiceContainer
    console.log(`LOG EMIT URL: [API_URL_NEEDED]/emit-log`);
    
    // Temporary disable until we have full config in container
    console.log(`[${log.service.toUpperCase()}] Log would be sent:`, log.message);
    console.log('Payload:', payload);
    
    // await axios.post(`${apiUrl}/emit-log`, payload, {
    //   headers: {
    //     Authorization: `Bearer ${token}`,
    //   },
    // });

  } catch (err: any) {
    console.error("❌ Failed to send log:", err.message);
  }
}