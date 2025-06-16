// src/app.ts - LIMPIO Y ORDENADO
import express from "express";
import helmet from "helmet";
import path from "path"; // 🔥 FALTABA
import fs from "fs";
import { getConfigAsync } from "./config/envConfig";
import { validateConfig } from "./config/config-validator";
import { initServiceContainer } from "./services/serviceContainer";
import { createAuthenticateJWT } from "./middlewares/authenticateJWT";
import { authorizeAdmin } from "./middlewares";
import authRoutes from "./routes/authRoutes";
import emailPublicRoutes from "./services/email/publicRoutes";
import pdfRoutes from "./services/pdf/routes";
import zplRoutes from "./services/zpl/routes";
import logger from "./utils/logging";
import gdprRoutes from "./routes/gdprRoutes";
import { initGDPRService } from "./services/gdpr/gdprTokenService";
import { FileWatcher } from "./config/FileWatcher";
import { initServerMonitoring } from "./services/monitoring/ServerMonitoringService"; // 🔥 FALTABA

const startApp = async () => {
  const config = await getConfigAsync();

  // Un solo log de config
  logger.system("Config loaded successfully", {
    config_source: config.config_source || "unknown",
    config_structure:
      config.config_source === "SOPS_ARRAY_STRUCTURE" ? "NEW_ARRAYS" : "LEGACY",
    tenant_id: config.tenantClientId,
    tenant_name: config.tenantName,
    environment: config.environment,
    has_required_fields: !!(
      config.clientId &&
      config.senderEmail &&
      config.jwtSecret
    ),
  });

  validateConfig(config);
  logger.system("Config validation passed", {
    validated_fields: ["clientId", "clientSecret", "tenantId", "senderEmail"],
    config_mode: config.config_source,
  });

  await initServiceContainer(config);
  logger.container("Service container initialized successfully", {
    email_config: !!config.senderEmail,
    pdf_config: !!config.certPdfSignPath,
    jwt_config: !!config.jwtSecret,
  });

  // After initServiceContainer:
  initGDPRService();
  logger.system("GDPR service initialized", {
    default_token_expiry: "24 hours",
    cleanup_interval: "1 hour",
  });

  logger.startMetrics(30000); // Start metrics collection every 30 seconds
  logger.system("Metrics collection started", {
    interval_ms: 30000,
    metrics_file: "core-services-metrics-*.log",
  });

  // Create JWT middleware with loaded config
  const authenticateJWT = createAuthenticateJWT(config.jwtSecret);
  logger.auth("JWT middleware created", {
    jwt_secret_length: config.jwtSecret?.length || 0,
  });

  const app = express();
  app.use(helmet());
  app.use(express.json());

  // Auth routes - for login capability
  app.use("/auth", authRoutes);

  // EMAIL ROUTES - TESTING MODE (authentication disabled)
  app.use("/api/email", /*authenticateJWT, authorizeAdmin,*/ emailPublicRoutes);
  app.use("/api/gdpr", gdprRoutes);

  // Public routes for pdf and zpl services - TESTING MODE (authentication disabled)
  app.use("/generate-pdf", /*authenticateJWT, authorizeAdmin,*/ pdfRoutes);
  app.use("/generate-zpl", /*authenticateJWT, authorizeAdmin,*/ zplRoutes);

  app.get("/health", (_, res) => {
    res.status(200).send("OK");
  });

  logger.system("Express server configuration completed", {
    routes: [
      "/auth",
      "/api/email",
      "/api/gdpr",
      "/generate-pdf",
      "/generate-zpl",
      "/health",
    ],
    middleware: ["helmet", "express.json"],
    authentication: "DISABLED_FOR_TESTING",
  });

  // 🔥 SECCIÓN DE MONITORING Y FILE WATCHING - LIMPIA Y ORDENADA 🔥

  // 1. Inicializar Server Monitoring
  const configPath = path.join(
    path.resolve(__dirname, "../../core-envs-private"),
    `clients/${config.tenantClientId || "core-dev"}/config.yaml`
  );

  // Añade estos logs ANTES de inicializar ServerMonitoring:
  logger.system("Debug: Config path construction", {
    __dirname,
    resolved_path: path.resolve(__dirname, "../../core-envs-private"),
    tenant_id: config.tenantClientId,
    final_path: configPath,
    exists: fs.existsSync(configPath),
  });

  const serverMonitoring = initServerMonitoring(configPath);
  await serverMonitoring.loadServers();
  logger.system("Server monitoring service initialized", {
    servers_count: serverMonitoring.getAllServers().length,
  });

  // 2. Configurar File Watcher (si está habilitado)
  if (
    config.configReloadIntervalMinutes &&
    config.configReloadIntervalMinutes > 0
  ) {
    logger.system("Initializing configuration hot reload", {
      interval_minutes: config.configReloadIntervalMinutes,
      watched_files: ["config.yaml"],
    });

    const watcher = new FileWatcher({
      intervalMinutes: config.configReloadIntervalMinutes,
      files: [
        {
          name: "config",
          path: configPath, // Reutilizamos la misma ruta
          decrypt: false,
        },
      ],
    });

    // Manejar cambios
    watcher.on("fileChanged", async (file, oldHash, newHash) => {
      if (file.name === "config") {
        logger.system(
          "Configuration change detected, reloading server monitoring",
          {
            file: file.name,
          }
        );

        try {
          const { reloadServerMonitoring } = await import(
            "./services/monitoring/ServerMonitoringService"
          );
          await reloadServerMonitoring();
        } catch (error) {
          logger.error("Failed to reload server monitoring", {
            error: (error as Error).message,
          });
        }
      }
    });

    await watcher.start();

    // Guardar referencia global para cleanup
    (global as any).configWatcher = watcher;
  } else {
    logger.system("Configuration hot reload disabled", {
      reason: "config_reload_interval_minutes not set or is 0",
    });
  }

  // 🔥 FIN DE MONITORING 🔥

  // FIXED: Dynamic host and port configuration
  const PORT = config.servicesPort || 3001;
  const HOST = process.env.HOST || "0.0.0.0";

  const getBaseUrl = () => {
    if (config.coreApiHost) {
      return config.coreApiHost;
    }

    if (process.env.API_BASE_URL) {
      return process.env.API_BASE_URL;
    }

    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const hostname = process.env.HOSTNAME || "localhost";
    return `${protocol}://${hostname}`;
  };

  const baseUrl = getBaseUrl();
  const fullApiUrl = `${baseUrl}:${PORT}`;

  app.listen(PORT, HOST, () => {
    logger.system(`Core Services API started successfully`, {
      host: HOST,
      port: PORT,
      base_url: baseUrl,
      full_api_url: fullApiUrl,
      listen_address: `${HOST}:${PORT}`,
      api_endpoints: {
        health: `${fullApiUrl}/health`,
        auth: `${fullApiUrl}/auth/login`,
        email: `${fullApiUrl}/api/email/send-with-consent`,
        pdf: `${fullApiUrl}/generate-pdf`,
        zpl: `${fullApiUrl}/generate-zpl`,
        gdpr: `${fullApiUrl}/api/gdpr/generate-token`,
      },
      configuration: {
        environment: process.env.NODE_ENV || "development",
        config_source: config.config_source,
        api_host_from: config.coreApiHost
          ? "config"
          : process.env.API_BASE_URL
          ? "env_API_BASE_URL"
          : "fallback",
        hot_reload: !!config.configReloadIntervalMinutes,
      },
      features: [
        "ISO 27001 compliant emails",
        "PDF generation with signing",
        "ZPL label generation",
        "GDPR consent management",
        config.configReloadIntervalMinutes ? "Hot config reload" : null,
      ].filter(Boolean),
      ready: true,
    });
  });
};

logger.system("Starting Core Services application", {
  node_version: process.version,
  platform: process.platform,
  environment: process.env.NODE_ENV || "development",
  hostname: process.env.HOSTNAME || "localhost",
  host_binding: process.env.HOST || "0.0.0.0",
});

startApp().catch((error) => {
  logger.error("Failed to start Core Services application", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
