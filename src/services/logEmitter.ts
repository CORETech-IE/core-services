import axios from "axios";
import config from "../config/envConfig";
import { getAuthToken } from "../utils/getToken";

export interface LogPayload {
  level: "INFO" | "ERROR" | "WARN" | "DEBUG" | "TRACE" | "FATAL" | "CRITICAL" | "ALERT" | "EMERGENCY" | "NOTICE" | "AUDIT" ;
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

    const payload = {
      client_id: config.tenantClientId,
      timestamp: new Date().toISOString(),
      ...log,
    };

    console.log(`LOG EMIT URL: ${config.apiUrl}/emit-log`);

    await axios.post(`${config.apiUrl}/emit-log`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log(`[${log.service.toUpperCase()}] Log sent:`, log.message);
  } catch (err: any) {
    console.error("❌ Failed to send log:", err.message);
  }
}
