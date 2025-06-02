
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
 * Evaluates the provided attributes against the GDPR consent policy.
 * 
 * @param attributes - The attributes to evaluate, including gdpr_token, payload_hash, and optional fields.
 * @returns A PDPDecision indicating whether the request is allowed or denied, along with a reason.
 */
export const evaluatePolicy = (attributes: PDPAttributes): PDPDecision => {
  // Simulación: consentimientos válidos (dummy)
  const mockConsentDatabase = new Map<string, { hash: string; expiresAt: string; subject: string }>([
    ['token-gdpr-hash08a0', {
        hash: 'fa9c54db45323aa107b594152b4a9a58a62d45c1dfb33eabd07aa40dcbccc275',
        expiresAt: '2099-12-31T23:59:59.000Z',
        subject: 'alejandro.prado@coretechnology.ie'
      }]
      
  ]);

  const consent = mockConsentDatabase.get(attributes.gdpr_token);
  if (!consent) {
    return { allow: false, reason: 'Invalid or expired gdpr_token' };
  }

  if (consent.hash !== attributes.payload_hash) {
    return { allow: false, reason: 'Payload hash does not match registered consent' };
  }

  if (new Date(consent.expiresAt) < new Date()) {
    return { allow: false, reason: 'Consent has expired' };
  }

  if (attributes.subject && consent.subject !== attributes.subject) {
    return { allow: false, reason: 'Subject mismatch' };
  }

  return { allow: true, reason: 'Consent valid and policy conditions met' };
};
