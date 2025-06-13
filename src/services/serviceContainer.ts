// src/services/serviceContainer.ts
import { EmailServiceConfig } from './email/emailService';
import { TokenServiceConfig } from './email/tokenService';
import { PdfSigningConfig } from '../types/pdfTypes';
import { AuthConfig } from '../utils/getToken';
import { initializeBrowserPool } from '../config/browserPool';

/**
 * Browser Pool Configuration
 */
export interface BrowserPoolConfig {
  maxBrowsers: number;
  maxPagesPerBrowser: number;
  pageIdleTimeout: number;
}

/**
 * Service Container for Dependency Injection
 * Centralizes all service configurations and provides clean access
 */
export class ServiceContainer {
  private emailConfig: EmailServiceConfig;
  private jwtSecret: string;
  private pdfSigningConfig: PdfSigningConfig;
  private authConfig: AuthConfig;
  private browserPoolConfig: BrowserPoolConfig;

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
      authUrl: appConfig.authFullUrl,
      authUsername: appConfig.authUsername,
      authPassword: appConfig.authPassword
    };

    // Browser Pool configuration
    this.browserPoolConfig = {
      maxBrowsers: appConfig.maxBrowsers || 2,
      maxPagesPerBrowser: appConfig.maxPagesPerBrowser || 3,
      pageIdleTimeout: appConfig.pageIdleTimeout || 300000
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

  /**
   * Get Browser Pool Configuration
   */
  getBrowserPoolConfig(): BrowserPoolConfig {
    return this.browserPoolConfig;
  }
}

// Global service container instance
let serviceContainer: ServiceContainer | null = null;

/**
 * Initialize the service container with app configuration
 * Should be called once during app startup
 */
export async function initServiceContainer(appConfig: any): Promise<ServiceContainer> {
  serviceContainer = new ServiceContainer(appConfig);
  
  // Inicializar browser pool con la configuración del container
  await initializeBrowserPool(serviceContainer.getBrowserPoolConfig());
  
  console.log('🌐 Browser pool initialized with config:', {
    maxBrowsers: serviceContainer.getBrowserPoolConfig().maxBrowsers,
    maxPagesPerBrowser: serviceContainer.getBrowserPoolConfig().maxPagesPerBrowser,
    pageIdleTimeout: serviceContainer.getBrowserPoolConfig().pageIdleTimeout
  });
  
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