// src/services/serviceContainer.ts

import { EmailServiceConfig } from './email/emailService';
import { TokenServiceConfig } from './email/tokenService';
import { PdfSigningConfig } from '../types/pdfTypes';
import { AuthConfig } from '../utils/getToken';

/**
 * Service Container for Dependency Injection
 * Centralizes all service configurations and provides clean access
 */
export class ServiceContainer {
  private emailConfig: EmailServiceConfig;
  private jwtSecret: string;
  private pdfSigningConfig: PdfSigningConfig;
  private authConfig: AuthConfig;

  constructor(appConfig: any) {
    // Email service configuration
    this.emailConfig = {
      senderEmail: appConfig.senderEmail,
      tokenEndpoint: appConfig.tokenEndpoint,
      tenantId: appConfig.tenantId,
      clientId: appConfig.clientId,
      clientSecret: appConfig.clientSecret
    };

    // JWT configuration
    this.jwtSecret = appConfig.jwtSecret;

    // PDF signing configuration
    this.pdfSigningConfig = {
      certPdfSignPath: appConfig.certPdfSignPath,
      certPdfSignPassword: appConfig.certPdfSignPassword,
      certPdfSignType: appConfig.certPdfSignType || 'p12'
    };

    // Auth configuration
    this.authConfig = {
      authUrl: appConfig.authFullUrl, // Using authFullUrl from your original config
      authUsername: appConfig.authUsername,
      authPassword: appConfig.authPassword
    };
  }

  /**
   * Get Email Service Configuration
   */
  getEmailConfig(): EmailServiceConfig {
    return this.emailConfig;
  }

  /**
   * Get Token Service Configuration
   */
  getTokenConfig(): TokenServiceConfig {
    return {
      tokenEndpoint: this.emailConfig.tokenEndpoint,
      tenantId: this.emailConfig.tenantId,
      clientId: this.emailConfig.clientId,
      clientSecret: this.emailConfig.clientSecret
    };
  }

  /**
   * Get JWT Secret
   */
  getJwtSecret(): string {
    return this.jwtSecret;
  }

  /**
   * Get PDF Signing Configuration
   */
  getPdfSigningConfig(): PdfSigningConfig {
    return this.pdfSigningConfig;
  }

  /**
   * Get Auth Configuration
   */
  getAuthConfig(): AuthConfig {
    return this.authConfig;
  }
}

// Global service container instance
let serviceContainer: ServiceContainer | null = null;

/**
 * Initialize the service container with app configuration
 * Should be called once during app startup
 */
export function initServiceContainer(appConfig: any): ServiceContainer {
  serviceContainer = new ServiceContainer(appConfig);
  return serviceContainer;
}

/**
 * Get the initialized service container
 * Throws error if not initialized
 */
export function getServiceContainer(): ServiceContainer {
  if (!serviceContainer) {
    throw new Error('Service container not initialized. Call initServiceContainer() first.');
  }
  return serviceContainer;
}