// src/types/iso27001.ts

/**
 * ISO 27001 Annex A.8.2 - Information Classification Levels
 * 
 * These classification levels map directly to ISO 27001 security controls
 * and determine the appropriate security measures for each email.
 */
export type ISO27001Classification = 'internal' | 'confidential' | 'restricted';

/**
 * ISO 27001 Security Control Mapping
 * 
 * - internal: A.9.4.1 (Information access restriction)
 * - confidential: A.9.4.1 + A.13.2.1 (Information transfer)  
 * - restricted: A.9.4.1 + A.13.2.1 + A.13.2.3 (Electronic messaging with digital signatures)
 */
export interface ISO27001SecurityControls {
  accessRestriction: boolean;      // A.9.4.1
  informationTransfer: boolean;    // A.13.2.1
  electronicMessaging: boolean;    // A.13.2.3
  auditLogging: boolean;          // A.12.4.1
}

/**
 * Maps ISO classification to required security controls
 */
export const getSecurityControls = (classification: ISO27001Classification): ISO27001SecurityControls => {
  switch (classification) {
    case 'internal':
      return {
        accessRestriction: true,
        informationTransfer: false,
        electronicMessaging: false,
        auditLogging: true
      };
    case 'confidential':
      return {
        accessRestriction: true,
        informationTransfer: true,
        electronicMessaging: false,
        auditLogging: true
      };
    case 'restricted':
      return {
        accessRestriction: true,
        informationTransfer: true,
        electronicMessaging: true,
        auditLogging: true
      };
    default:
      throw new Error(`Invalid ISO 27001 classification: ${classification}`);
  }
};