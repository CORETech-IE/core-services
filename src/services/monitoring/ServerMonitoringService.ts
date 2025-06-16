// src/services/monitoring/ServerMonitoringService.ts

import yaml from "js-yaml";
import fs from "fs";
import path from "path";
import os from "os";
import logger from "../../utils/logging";
import { getServiceContainer } from "../serviceContainer";
import { HeartbeatService } from "./HeartbeatService";

interface ServerMonitoring {
  heartbeat: boolean;
  heartbeat_interval_seconds?: number;
  metrics: boolean;
  metrics_interval_seconds?: number;
  logs: boolean;
}

interface Server {
  name: string;
  hostname: string;
  monitoring: ServerMonitoring;
  tags?: string[];
}

class ServerMonitoringService {
  private servers: Map<string, Server> = new Map();
  private configPath: string;
  private heartbeatService: HeartbeatService | null = null;
  private myServerIdentity: string;  // 🔥 NUEVO: Mi identidad

  private initHeartbeatService(): void {
    const container = getServiceContainer();
    const config = container.getAuthConfig();

    // Construir URL del backend desde la config
    const backendUrl = config.authUrl.replace("/auth/login", ""); // Quitar el path de auth

    this.heartbeatService = new HeartbeatService(backendUrl); 
  }

  constructor(configPath: string) {
    this.configPath = configPath;
    this.myServerIdentity = this.getMyServerIdentity();  // 🔥 NUEVO: Identificarme
    
    logger.system("Server identity determined", {
      my_server_identity: this.myServerIdentity,
      hostname: os.hostname(),
      platform: os.platform(),
      server_name_env: process.env.SERVER_NAME || 'not_set'
    });
    
    this.initHeartbeatService();
  }

  /**
   * 🔥 NUEVO: Determina la identidad de este servidor
   */
  private getMyServerIdentity(): string {
    // 1. Prioridad máxima: Variable de entorno SERVER_NAME
    if (process.env.SERVER_NAME) {
      logger.system("Using SERVER_NAME from environment", {
        server_name: process.env.SERVER_NAME
      });
      return process.env.SERVER_NAME;
    }
    
    // 2. Hostname del sistema
    const hostname = os.hostname().toLowerCase();
    console.log("Detected hostname:", hostname);
    logger.system("Using system hostname for identity", {
        hostname
        });
    
    // 3. Para desarrollo local (Windows/Mac con nombres tipo DESKTOP-XXX)
    if (hostname === 'localhost' || 
        hostname.includes('desktop-') || 
        hostname.includes('laptop-') ||
        hostname.includes('cul-mit-dvdi13') ||
        hostname.includes('macbook')) {
      logger.system("Detected development environment", {
        hostname,
        using_identity: 'localhost-dev'
      });
      return 'localhost-dev';
    }
    
    // 4. Para servidores reales, usar el hostname
    logger.system("Using system hostname as identity", {
      hostname
    });
    
    return hostname;
  }

  /**
   * Carga inicial de la configuración de servidores
   */
  async loadServers(): Promise<void> {
    try {
      const yamlContent = fs.readFileSync(this.configPath, "utf8");
      const config = yaml.load(yamlContent) as any;

      if (!config.servers || !Array.isArray(config.servers)) {
        logger.warn("No servers configuration found in config.yaml");
        return;
      }

      // Limpiar y recargar
      this.servers.clear();

      for (const server of config.servers) {
        this.servers.set(server.name, {
          name: server.name,
          hostname: server.hostname,
          monitoring: {
            heartbeat: server.monitoring?.heartbeat || false,
            heartbeat_interval_seconds:
              server.monitoring?.heartbeat_interval_seconds || 60, // Default 60s
            metrics: server.monitoring?.metrics || false,
            metrics_interval_seconds:
              server.monitoring?.metrics_interval_seconds || 300, // Default 5min
            logs: server.monitoring?.logs || false,
          },
          tags: server.tags || [],
        });

        logger.system("Server monitoring configuration loaded", {
          server_name: server.name,
          hostname: server.hostname,
          monitoring: server.monitoring,
        });
      }

      logger.system("All server configurations loaded", {
        server_count: this.servers.size,
        servers: Array.from(this.servers.keys()),
        my_server_identity: this.myServerIdentity
      });

      // 🔥 CAMBIO: Solo iniciar MI heartbeat
      const myServerConfig = this.servers.get(this.myServerIdentity);
      
      if (!myServerConfig) {
        logger.warn("My server configuration not found", {
          my_identity: this.myServerIdentity,
          available_servers: Array.from(this.servers.keys()),
          suggestion: `Add a server entry with name: '${this.myServerIdentity}' to config.yaml`
        });
        return;
      }

      logger.system("Found my server configuration", {
        server_name: myServerConfig.name,
        hostname: myServerConfig.hostname,
        monitoring_enabled: {
          heartbeat: myServerConfig.monitoring.heartbeat,
          metrics: myServerConfig.monitoring.metrics,
          logs: myServerConfig.monitoring.logs
        }
      });

      // Solo iniciar MI heartbeat si está habilitado
      if (myServerConfig.monitoring.heartbeat) {
        const interval = myServerConfig.monitoring.heartbeat_interval_seconds || 60;

        logger.system("Starting MY heartbeat monitoring", {
          server_name: myServerConfig.name,
          hostname: myServerConfig.hostname,
          interval_seconds: interval
        });

        if (!this.heartbeatService) {
          this.initHeartbeatService();
        }

        await this.heartbeatService!.startHeartbeat(
          myServerConfig.name,
          myServerConfig.hostname,
          interval
        ).catch((error) => {
          logger.error("Failed to start my heartbeat", {
            server: myServerConfig.name,
            error: (error as Error).message,
            stack: (error as Error).stack
          });
        });
      } else {
        logger.system("Heartbeat monitoring disabled for this server", {
          server_name: myServerConfig.name
        });
      }

    } catch (error) {
      logger.error("Failed to load server configurations", {
        error: (error as Error).message,
        config_path: this.configPath,
      });
      throw error;
    }
  }

  /**
   * Recarga solo la configuración de monitoring de los servidores
   */
  async reloadMonitoringConfig(): Promise<void> {
    try {
      const yamlContent = fs.readFileSync(this.configPath, "utf8");
      const config = yaml.load(yamlContent) as any;

      if (!config.servers || !Array.isArray(config.servers)) {
        logger.warn("No servers configuration found during reload");
        return;
      }

      let changesDetected = 0;

      for (const serverConfig of config.servers) {
        const existingServer = this.servers.get(serverConfig.name);

        if (existingServer) {
          // Comparar valores de monitoring
          const oldMonitoring = { ...existingServer.monitoring };
          const newMonitoring = {
            heartbeat: serverConfig.monitoring?.heartbeat || false,
            heartbeat_interval_seconds: serverConfig.monitoring?.heartbeat_interval_seconds || 60,
            metrics: serverConfig.monitoring?.metrics || false,
            metrics_interval_seconds: serverConfig.monitoring?.metrics_interval_seconds || 300,
            logs: serverConfig.monitoring?.logs || false,
          };

          // Detectar cambios
          if (JSON.stringify(oldMonitoring) !== JSON.stringify(newMonitoring)) {
            changesDetected++;

            logger.system("Server monitoring configuration changed", {
              server_name: serverConfig.name,
              old_config: oldMonitoring,
              new_config: newMonitoring,
            });

            // Actualizar configuración
            existingServer.monitoring = newMonitoring;

            // 🔥 CAMBIO: Solo notificar cambios si es MI servidor
            if (serverConfig.name === this.myServerIdentity) {
              logger.system("MY server configuration changed, applying", {
                server_name: serverConfig.name
              });
              
              this.notifyMonitoringChange(
                serverConfig.name,
                oldMonitoring,
                newMonitoring
              );
            } else {
              logger.system("Configuration changed for OTHER server (ignored)", {
                server_name: serverConfig.name,
                my_identity: this.myServerIdentity
              });
            }
          }
        } else {
          // Servidor nuevo (no deberíamos llegar aquí en hot reload, pero por si acaso)
          logger.warn("New server found during hot reload (ignored)", {
            server_name: serverConfig.name,
          });
        }
      }

      logger.system("Server monitoring reload completed", {
        servers_checked: config.servers.length,
        changes_detected: changesDetected,
        my_server_identity: this.myServerIdentity
      });
      
    } catch (error) {
      logger.error("Failed to reload server monitoring", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Notifica cambios en la configuración de monitoring
   */
  private notifyMonitoringChange(
    serverName: string,
    oldConfig: ServerMonitoring,
    newConfig: ServerMonitoring
  ): void {
    if (!this.heartbeatService) {
      this.initHeartbeatService();
    }

    const server = this.servers.get(serverName);
    if (!server) return;

    // Heartbeat change
    if (oldConfig.heartbeat !== newConfig.heartbeat) {
      if (newConfig.heartbeat) {
        const interval = newConfig.heartbeat_interval_seconds || 60;
        // Iniciar heartbeat
        logger.system("Enabling heartbeat monitoring", {
          server: serverName,
          interval_seconds: interval
        });
        
        this.heartbeatService!.startHeartbeat(
          server.name,
          server.hostname,
          interval
        ).catch((error) => {
          logger.error("Failed to start heartbeat", {
            server: serverName,
            error: (error as Error).message,
          });
        });
      } else {
        // Detener heartbeat
        logger.system("Disabling heartbeat monitoring", {
          server: serverName
        });
        this.heartbeatService!.stopHeartbeat(server.name);
      }
    }

    // Si el heartbeat está activo y cambió el intervalo
    if (
      oldConfig.heartbeat &&
      newConfig.heartbeat &&
      oldConfig.heartbeat_interval_seconds !==
        newConfig.heartbeat_interval_seconds
    ) {
      logger.system("Heartbeat interval changed, restarting", {
        server: serverName,
        old_interval: oldConfig.heartbeat_interval_seconds,
        new_interval: newConfig.heartbeat_interval_seconds,
      });

      // Parar y reiniciar con nuevo intervalo
      this.heartbeatService!.stopHeartbeat(server.name);
      this.heartbeatService!.startHeartbeat(
        server.name,
        server.hostname,
        newConfig.heartbeat_interval_seconds || 60
      ).catch((error) => {
        logger.error("Failed to restart heartbeat with new interval", {
          server: serverName,
          error: (error as Error).message,
        });
      });
    }

    if (oldConfig.metrics !== newConfig.metrics) {
      logger.system(
        `Metrics collection ${newConfig.metrics ? "enabled" : "disabled"}`,
        {
          server: serverName,
        }
      );
      // TODO: Implementar start/stop metrics
    }

    if (oldConfig.logs !== newConfig.logs) {
      logger.system(
        `Log forwarding ${newConfig.logs ? "enabled" : "disabled"}`,
        {
          server: serverName,
        }
      );
      // TODO: Implementar start/stop logs
    }
  }

  /**
   * Obtiene la configuración de un servidor
   */
  getServer(name: string): Server | undefined {
    return this.servers.get(name);
  }

  /**
   * Obtiene todos los servidores
   */
  getAllServers(): Server[] {
    return Array.from(this.servers.values());
  }

  /**
   * 🔥 NUEVO: Obtiene mi configuración
   */
  getMyServer(): Server | undefined {
    return this.servers.get(this.myServerIdentity);
  }

  // (Removed duplicate getMyServerIdentity method to fix duplicate implementation error)
}

// Singleton instance
let serverMonitoringService: ServerMonitoringService | null = null;

/**
 * Inicializa el servicio (llamar en app.ts después de cargar config)
 */
export function initServerMonitoring(
  configPath: string
): ServerMonitoringService {
  serverMonitoringService = new ServerMonitoringService(configPath);
  return serverMonitoringService;
}

/**
 * Obtiene la instancia del servicio
 */
export function getServerMonitoring(): ServerMonitoringService {
  if (!serverMonitoringService) {
    throw new Error("ServerMonitoringService not initialized");
  }
  return serverMonitoringService;
}

/**
 * Función helper para el FileWatcher
 */
export async function reloadServerMonitoring(): Promise<void> {
  const service = getServerMonitoring();
  await service.reloadMonitoringConfig();
}