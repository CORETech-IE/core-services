// services/gdpr/gdprTokenService.ts

import crypto from 'crypto';
import logger from '../../utils/logging';
import { v4 as uuidv4 } from 'uuid';

/**
 * GDPR Token Service - Production Implementation
 * 
 * Generates and validates GDPR consent tokens with payload hash validation
 * Implements Zero Trust principles for email consent verification
 */

export interface GDPRConsentRecord {
  token: string;
  original_hash: string;
  signed_hash?: string;  // Generated after PDF signing
  subject: string;
  purpose: string;
  created_at: string;
  expires_at: string;
  user_id?: string;
  client_id?: string;
}

export interface GDPRTokenRequest {
  recipient_email: string;
  purpose: string;
  payload_hash: string;
  expires_in_hours?: number;
  user_id?: string;
  client_id?: string;
}

export interface GDPRValidationRequest {
  token: string;
  payload_hash: string;
  recipient_email: string;
  purpose?: string;
}

export interface GDPRValidationResult {
  valid: boolean;
  reason: string;
  consent_record?: GDPRConsentRecord;
  hash_type?: 'original' | 'signed';
}

/**
 * In-memory consent store (production should use database)
 * This is a simple implementation for immediate use
 */
class ConsentStore {
  private consents = new Map<string, GDPRConsentRecord>();
  
  save(record: GDPRConsentRecord): void {
    this.consents.set(record.token, record);
    
    logger.system('GDPR consent record saved', {
      token_preview: record.token.substring(0, 8) + '...',
      subject: record.subject,
      purpose: record.purpose,
      expires_at: record.expires_at,
      has_signed_hash: !!record.signed_hash
    });
  }
  
  get(token: string): GDPRConsentRecord | undefined {
    return this.consents.get(token);
  }
  
  updateSignedHash(token: string, signed_hash: string): boolean {
    const record = this.consents.get(token);
    if (record) {
      record.signed_hash = signed_hash;
      this.consents.set(token, record);
      
      logger.system('GDPR consent signed hash updated', {
        token_preview: token.substring(0, 8) + '...',
        signed_hash: signed_hash.substring(0, 16) + '...'
      });
      
      return true;
    }
    return false;
  }
  
  cleanup(): void {
    const now = new Date();
    const expired: string[] = [];
    
    this.consents.forEach((record, token) => {
      if (new Date(record.expires_at) < now) {
        expired.push(token);
      }
    });
    
    expired.forEach(token => this.consents.delete(token));
    
    if (expired.length > 0) {
      logger.system('GDPR consent cleanup completed', {
        expired_tokens: expired.length,
        remaining_tokens: this.consents.size
      });
    }
  }
  
  getStats(): { total: number; active: number; expired: number } {
    const now = new Date();
    let active = 0;
    let expired = 0;
    
    this.consents.forEach(record => {
      if (new Date(record.expires_at) < now) {
        expired++;
      } else {
        active++;
      }
    });
    
    return { total: this.consents.size, active, expired };
  }
}

/**
 * GDPR Token Service Implementation
 */
export class GDPRTokenService {
  private consentStore: ConsentStore;
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    this.consentStore = new ConsentStore();
    this.startCleanupTimer();
  }
  
  /**
   * Generate a new GDPR consent token
   * 
   * @param request - Token generation request
   * @returns Generated consent record with token
   */
  generateToken(request: GDPRTokenRequest): GDPRConsentRecord {
    const trace_id = uuidv4();
    
    logger.system('Generating GDPR consent token', {
      trace_id,
      recipient: request.recipient_email,
      purpose: request.purpose,
      payload_hash: request.payload_hash.substring(0, 16) + '...',
      expires_in_hours: request.expires_in_hours || 24
    });
    
    // Generate unique token
    const token = this.createUniqueToken();
    
    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (request.expires_in_hours || 24));
    
    // Create consent record
    const record: GDPRConsentRecord = {
      token,
      original_hash: request.payload_hash,
      subject: request.recipient_email,
      purpose: request.purpose,
      created_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      user_id: request.user_id,
      client_id: request.client_id
    };
    
    // Store the consent
    this.consentStore.save(record);
    
    logger.system('GDPR consent token generated successfully', {
      trace_id,
      token_preview: token.substring(0, 8) + '...',
      expires_at: record.expires_at,
      recipient: request.recipient_email
    });
    
    return record;
  }
  
  /**
   * Validate GDPR consent token and payload
   * 
   * @param request - Validation request
   * @returns Validation result
   */
  validateToken(request: GDPRValidationRequest): GDPRValidationResult {
    const trace_id = uuidv4();
    
    logger.system('Validating GDPR consent token', {
      trace_id,
      token_preview: request.token.substring(0, 8) + '...',
      payload_hash: request.payload_hash.substring(0, 16) + '...',
      recipient: request.recipient_email
    });
    
    // Clean up expired tokens first
    this.consentStore.cleanup();
    
    // Get consent record
    const record = this.consentStore.get(request.token);
    if (!record) {
      logger.warn('GDPR token validation failed - token not found', {
        trace_id,
        token_preview: request.token.substring(0, 8) + '...'
      });
      
      return {
        valid: false,
        reason: 'Invalid or expired GDPR token - no consent record found'
      };
    }
    
    // Check expiration
    if (new Date(record.expires_at) < new Date()) {
      logger.warn('GDPR token validation failed - token expired', {
        trace_id,
        token_preview: request.token.substring(0, 8) + '...',
        expires_at: record.expires_at
      });
      
      return {
        valid: false,
        reason: 'GDPR consent has expired'
      };
    }
    
    // Validate payload hash (original or signed)
    const originalMatch = record.original_hash === request.payload_hash;
    const signedMatch = record.signed_hash === request.payload_hash;
    
    if (!originalMatch && !signedMatch) {
      logger.warn('GDPR token validation failed - hash mismatch', {
        trace_id,
        token_preview: request.token.substring(0, 8) + '...',
        expected_original: record.original_hash.substring(0, 16) + '...',
        expected_signed: record.signed_hash?.substring(0, 16) + '...' || 'not_set',
        received: request.payload_hash.substring(0, 16) + '...'
      });
      
      return {
        valid: false,
        reason: `Payload hash does not match registered consent. Expected: ${record.original_hash} (original)${record.signed_hash ? ` or ${record.signed_hash} (signed)` : ''}, got: ${request.payload_hash}`
      };
    }
    
    // Validate subject
    if (record.subject !== request.recipient_email) {
      logger.warn('GDPR token validation failed - subject mismatch', {
        trace_id,
        token_preview: request.token.substring(0, 8) + '...',
        expected_subject: record.subject,
        received_subject: request.recipient_email
      });
      
      return {
        valid: false,
        reason: `Subject mismatch. Expected: ${record.subject}, got: ${request.recipient_email}`
      };
    }
    
    // Validate purpose if provided
    if (request.purpose && record.purpose !== request.purpose) {
      logger.warn('GDPR token validation failed - purpose mismatch', {
        trace_id,
        token_preview: request.token.substring(0, 8) + '...',
        expected_purpose: record.purpose,
        received_purpose: request.purpose
      });
      
      return {
        valid: false,
        reason: `Purpose mismatch. Expected: ${record.purpose}, got: ${request.purpose}`
      };
    }
    
    const hashType = originalMatch ? 'original' : 'signed';
    
    logger.system('GDPR token validation successful', {
      trace_id,
      token_preview: request.token.substring(0, 8) + '...',
      hashType,
      subject: record.subject,
      purpose: record.purpose
    });
    
    return {
      valid: true,
      reason: `Consent valid and policy conditions met (${hashType} payload hash)`,
      consent_record: record,
      hash_type: hashType
    };
  }
  
  /**
   * Update signed hash for existing consent (after PDF signing)
   * 
   * @param token - Consent token
   * @param signed_hash - Hash of payload with signed PDFs
   * @returns Success status
   */
  updateSignedHash(token: string, signed_hash: string): boolean {
    return this.consentStore.updateSignedHash(token, signed_hash);
  }
  
  /**
   * Create unique token with proper entropy
   */
  private createUniqueToken(): string {
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.randomBytes(16).toString('hex');
    return `gdpr_${timestamp}_${randomBytes}`;
  }
  
  /**
   * Start automatic cleanup of expired tokens
   */
  private startCleanupTimer(): void {
    // Clean up every hour
    this.cleanupInterval = setInterval(() => {
      this.consentStore.cleanup();
    }, 60 * 60 * 1000);
  }
  
  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  
  /**
   * Get service statistics
   */
  getStats(): { total: number; active: number; expired: number } {
    return this.consentStore.getStats();
  }
}

// Singleton instance
let gdprService: GDPRTokenService | null = null;

/**
 * Get GDPR service instance
 */
export function getGDPRService(): GDPRTokenService {
  if (!gdprService) {
    gdprService = new GDPRTokenService();
  }
  return gdprService;
}

/**
 * Initialize GDPR service (called from app startup)
 */
export function initGDPRService(): GDPRTokenService {
  if (gdprService) {
    gdprService.stopCleanupTimer();
  }
  gdprService = new GDPRTokenService();
  
  logger.system('GDPR token service initialized', {
    cleanup_interval: '1 hour',
    default_token_expiry: '24 hours'
  });
  return gdprService;
} 