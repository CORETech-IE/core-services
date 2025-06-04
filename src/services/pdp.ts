import crypto from 'crypto';

/**
 * PDP (Policy Decision Point) service for evaluating GDPR consent policies.
 * This service checks if a given set of attributes meets the policy requirements.
 */
export type PDPAttributes = {
  gdpr_token: string;
  payload_hash: string;
  purpose?: string;
  expiration?: string; // ISO string
  subject?: string;
  user_id?: string;
};

// Represents the decision made by the PDP service
// It indicates whether the request is allowed or denied, along with a reason.
// The decision is based on the evaluation of the provided attributes against the policy.
// The decision can be used to enforce access control or compliance with GDPR regulations.
export type PDPDecision = {
  allow: boolean;
  reason: string;
};

/**
 * Mock consent database for testing double validation flow
 * 
 * In production, this would be a real database with consent records.
 * Each entry represents a GDPR consent with both original and signed payload hashes.
 * 
 * The system validates twice:
 * 1. First validation: original payload hash (before PDF signing)
 * 2. Second validation: signed payload hash (after PDF signing)
 * 
 * Both hashes must be pre-registered for the same consent token.
 */
const mockConsentDatabase = new Map<string, { 
  original_hash: string; 
  signed_hash: string; 
  expiresAt: string; 
  subject: string;
  purpose: string;
}>([
  ['token-gdpr-hash08a0', {
    // Hash of payload with original PDF path
    original_hash: '2033748d2d308f33a1350741264822a5a2e62f2747681193f8674abd0c861720',
    // Hash of payload with _signed.pdf path  
    signed_hash: '7515da9f7b87ae50786c68288e1c70aebc54ac0b3a56bfeb11673ec62925ea54',
    expiresAt: '2099-12-31T23:59:59.000Z',
    subject: 'alejandro.prado@coretechnology.ie',
    purpose: 'email_notification'
  }]
]);

/**
 * Evaluates the provided attributes against the GDPR consent policy.
 * 
 * This function implements Zero Trust validation by checking:
 * 1. Valid GDPR token exists in consent database
 * 2. Payload hash matches either original_hash OR signed_hash
 * 3. Consent has not expired
 * 4. Subject (email recipient) matches registered consent
 * 5. Purpose matches registered consent purpose
 * 
 * @param attributes - The attributes to evaluate, including gdpr_token, payload_hash, and optional fields.
 * @returns A PDPDecision indicating whether the request is allowed or denied, along with a reason.
 */
export const evaluatePolicy = (attributes: PDPAttributes): PDPDecision => {
  
  // Check if consent record exists for this token
  const consent = mockConsentDatabase.get(attributes.gdpr_token);
  if (!consent) {
    return { 
      allow: false, 
      reason: 'Invalid or expired gdpr_token - no consent record found' 
    };
  }

  // Validate payload hash matches either original or signed version
  // This allows both first validation (original) and second validation (signed) to pass
  const hashMatches = (
    consent.original_hash === attributes.payload_hash || 
    consent.signed_hash === attributes.payload_hash
  );
  
  if (!hashMatches) {
    return { 
      allow: false, 
      reason: `Payload hash does not match registered consent. Expected: ${consent.original_hash} (original) or ${consent.signed_hash} (signed), got: ${attributes.payload_hash}` 
    };
  }

  // Check if consent has expired
  if (new Date(consent.expiresAt) < new Date()) {
    return { 
      allow: false, 
      reason: 'Consent has expired' 
    };
  }

  // Validate subject (email recipient) matches
  if (attributes.subject && consent.subject !== attributes.subject) {
    return { 
      allow: false, 
      reason: `Subject mismatch. Expected: ${consent.subject}, got: ${attributes.subject}` 
    };
  }

  // Validate purpose matches (if specified)
  if (attributes.purpose && consent.purpose !== attributes.purpose) {
    return { 
      allow: false, 
      reason: `Purpose mismatch. Expected: ${consent.purpose}, got: ${attributes.purpose}` 
    };
  }

  // All validations passed
  const hashType = consent.original_hash === attributes.payload_hash ? 'original' : 'signed';
  
  return { 
    allow: true, 
    reason: `Consent valid and policy conditions met (${hashType} payload hash)` 
  };
};