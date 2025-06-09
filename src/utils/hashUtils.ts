// utils/hashUtils.ts

import { createHash } from 'crypto';

/**
 * Shared hash utility for consistent hashing across all services
 * 
 * This ensures that the GDPR token generation and email validation
 * use exactly the same hashing algorithm.
 */

/**
 * Sort object keys recursively for consistent hashing
 * This is the SINGLE SOURCE OF TRUTH for object sorting
 */
export function sortObjectRecursively(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectRecursively);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((result: any, key) => {
        result[key] = sortObjectRecursively(obj[key]);
        return result;
      }, {});
  }
  return obj;
}

/**
 * Generate consistent SHA-256 hash of any payload
 * This is the SINGLE SOURCE OF TRUTH for payload hashing
 */
export function generatePayloadHash(payload: any): string {
  const canonicalJson = JSON.stringify(sortObjectRecursively(payload));
  return createHash('sha256').update(canonicalJson).digest('hex');
}