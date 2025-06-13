import logger from '../utils/logging';

export function validateConfig(config: any): void {
  const requiredVars: { key: string; label: string }[] = [
    { key: "clientId", label: "CLIENT_ID" },
    { key: "clientSecret", label: "CLIENT_SECRET" },
    { key: "tenantId", label: "TENANT_CLIENT_ID" },
    { key: "senderEmail", label: "SENDER_EMAIL" },
  ];

  // SECURE: Only log config in verbose mode, and sanitize sensitive data
  logger.debug('Config validation started', {
    config_keys: config ? Object.keys(config) : null,
    config_size: config ? Object.keys(config).length : 0,
    // Only include non-sensitive config parts in verbose mode
    ...(logger.isVerbose() && {
      non_sensitive_config: {
        tenantClientId: config?.tenantClientId,
        coreApiHost: config?.coreApiHost,
        servicesPort: config?.servicesPort,
        backendPort: config?.backendPort,
        has_clientId: !!config?.clientId,
        has_clientSecret: !!config?.clientSecret,
        has_tenantId: !!config?.tenantId,
        has_senderEmail: !!config?.senderEmail,
        has_jwtSecret: !!config?.jwtSecret
      }
    })
  });

  // Handle null config (can happen in standalone mode if not properly loaded)
  if (!config) {
    logger.error("Configuration is null or undefined", {
      operation: 'SYSTEM',
      error_code: 'CONFIG_NULL'
    });
    process.exit(1);
  }

  const missing = requiredVars.filter(({ key }) => !config[key]);

  if (missing.length > 0) {
    const missingLabels = missing.map(({ label }) => label);
    
    logger.error("Missing required environment variables", {
      operation: 'SYSTEM',
      error_code: 'MISSING_ENV_VARS',
      missing_variables: missingLabels,
      missing_count: missing.length,
      total_required: requiredVars.length
    });
    
    process.exit(1);
  }

  // Success logging with secure details
  logger.system("Configuration validation successful", {
    required_vars_count: requiredVars.length,
    validated_keys: requiredVars.map(v => v.key),
    config_source: config.standalone_mode ? 'SOPS' : 'Environment',
    ...(logger.isVerbose() && {
      // Additional details only in verbose mode
      client_id_length: config.clientId?.length || 0,
      sender_email: config.senderEmail,
      tenant_id: config.tenantId
    })
  });
}