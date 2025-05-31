import axios from "axios";
import config from "../config/envConfig";
import { getAuthToken } from "../utils/getToken";

export interface MetricsPayload {
  service: string;
  metrics: Record<string, any>;
}

export async function sendMetrics(payloadData: MetricsPayload) {
  try {
    const token = await getAuthToken();

    if (!payloadData.service) {
      throw new Error("Missing 'service' in metrics payload");
    }

    const payload = {
      client_id: config.tenantClientId,
      service: payloadData.service,
      timestamp: new Date().toISOString(),
      metrics: payloadData.metrics
    };

    await axios.post(`${config.apiUrl}/api/metrics`, payload, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log(`[${payloadData.service.toUpperCase()}] 📊 Metrics sent`);
  } catch (err: any) {
    console.error("❌ Failed to send metrics:", err.message);
  }
}
