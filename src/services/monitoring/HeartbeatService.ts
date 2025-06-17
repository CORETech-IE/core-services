// src/services/monitoring/HeartbeatService.ts

import axios from "axios";
import { getAuthToken } from "../../utils/getToken";
import logger from "../../utils/logging";
import os from "os";

interface HeartbeatData {
  server_name: string;
  hostname: string;
  timestamp: string;
  status: "healthy" | "warning" | "error";
  system_info: {
    platform: string;
    uptime: number;
    memory: {
      total: number;
      free: number;
      used_percent: number;
    };
    cpu: {
      cores: number;
      load_average?: number[];
    };
  };
  service_info: {
    name: string;
    version: string;
    uptime: number;
    environment: string;
  };
}

export class HeartbeatService {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private intervalConfigs: Map<string, number> = new Map();
  private backendUrl: string;

  constructor(backendUrl: string, intervalSeconds: number = 60) {
    this.backendUrl = backendUrl;
  }

  /**
   * Inicia el envío de heartbeats para un servidor
   */
  async startHeartbeat(
    serverName: string,
    hostname: string,
    intervalSeconds: number = 60
  ): Promise<void> {
    // Si ya existe, no duplicar
    if (this.intervals.has(serverName)) {
      logger.warn("Heartbeat already running for server", {
        server_name: serverName,
      });
      return;
    }

    const intervalMs = intervalSeconds * 1000; // 🔥 CALCULAR AQUÍ

    logger.system("Starting heartbeat monitoring", {
      server_name: serverName,
      hostname,
      interval_seconds: intervalSeconds,
      backend_url: this.backendUrl,
    });

    // Guardar configuración
    this.intervalConfigs.set(serverName, intervalSeconds);

    // Enviar primer heartbeat inmediatamente
    console.log(serverName + ' + ' + hostname);
    await this.sendHeartbeat(serverName, hostname);

    // Configurar intervalo USANDO intervalMs LOCAL
    const interval = setInterval(async () => {
      try {
        await this.sendHeartbeat(serverName, hostname);
      } catch (error) {
        logger.error("Heartbeat failed", {
          server_name: serverName,
          error: (error as Error).message,
        });
      }
    }, intervalMs); // 🔥 USAR intervalMs, NO this.intervalMs

    this.intervals.set(serverName, interval);
  }

  /**
   * Detiene el envío de heartbeats para un servidor
   */
  stopHeartbeat(serverName: string): void {
    const interval = this.intervals.get(serverName);

    if (interval) {
      clearInterval(interval);
      this.intervals.delete(serverName);

      logger.system("Stopped heartbeat monitoring", {
        server_name: serverName,
      });
    }
  }

  /**
   * Envía un heartbeat al backend
   */
  private async sendHeartbeat(
    serverName: string,
    hostname: string
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Construir datos del heartbeat
      const heartbeatData = {
  client_id: serverName,  // Cambiar de server_name a client_id
  service: "core-services",
  timestamp: new Date().toISOString(),
  status: "OK",  // Cambiar de "healthy" a "OK"
  metadata: {
    uptime_sec: Math.floor(process.uptime()),
    version: process.env.npm_package_version || "1.0.0",
    pid: process.pid,
    hostname: hostname,
    env: process.env.NODE_ENV || "development",
    health_check_passed: true,
    free_mem_mb: Math.round(os.freemem() / 1024 / 1024),
    load_avg_1min: os.loadavg()[0] || 0
  }
};

      // Obtener token JWT
      const token = await getAuthToken();

      // Enviar al backend
      const response = await axios.post(
        `${this.backendUrl}/api/heartbeat`,
        heartbeatData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 10000, // 10 segundos timeout
        }
      );

      const duration = Date.now() - startTime;

      logger.info("Heartbeat sent successfully", {
        server_name: serverName,
        status_code: response.status,
        duration_ms: duration,
        response_ok: response.data?.success || false,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      if (axios.isAxiosError(error)) {
        logger.error("Heartbeat request failed", {
          server_name: serverName,
          duration_ms: duration,
          status_code: error.response?.status,
          error_message: error.message,
          backend_url: this.backendUrl,
        });
      } else {
        logger.error("Heartbeat error", {
          server_name: serverName,
          duration_ms: duration,
          error: (error as Error).message,
        });
      }

      throw error;
    }
  }

  /**
   * Detiene todos los heartbeats
   */
  stopAll(): void {
    for (const [serverName, interval] of this.intervals) {
      clearInterval(interval);
      logger.system("Stopped heartbeat", { server_name: serverName });
    }
    this.intervals.clear();
  }
}
