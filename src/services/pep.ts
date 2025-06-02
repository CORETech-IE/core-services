// src/services/pep.ts

import { evaluatePolicy, PDPAttributes } from './pdp';
import { z } from 'zod';
import { createHash } from 'crypto';
import { logger } from '../utils/logger';

const EmailPayloadSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1),
        path: z.string().min(1)
      })
    )
    .optional()
});

export const enforceEmailPolicy = (
  payload: unknown,
  gdpr_token: string
): { allowed: boolean; reason: string; hash?: string } => {
  // 1. Validación estricta del contenido
  const validation = EmailPayloadSchema.safeParse(payload);
  if (!validation.success) {
    logger.warn('Email payload failed schema validation', {
      reason: validation.error.message
    });
    return {
      allowed: false,
      reason: 'Schema validation failed'
    };
  }

  const validated = validation.data;

  console.log('Validated payload:', validated);
  // Log the validated payload for debugging    

  // 2. Ordenar y hashear el payload de forma determinista
  const hash = generatePayloadHash(validated);

  console.log('Payload hash:', hash);

  // 3. Atributos para PDP (modo estricto)
  const attributes: PDPAttributes = {
    gdpr_token,
    payload_hash: hash,
    subject: validated.to,
    purpose: 'email_notification',
    expiration: undefined, // future: from consent registry
    user_id: process.env.TENANT_CLIENT_ID
  };

  // 4. Consulta a PDP
  const decision = evaluatePolicy(attributes);

  // 5. Logging estructurado
  logger.info('ABAC decision evaluated', {
    user_id: process.env.TENANT_CLIENT_ID,
    hash,
    gdpr_token,
    attributes,
    decision
  });

  return {
    allowed: decision.allow,
    reason: decision.reason,
    hash
  };
};

// Función auxiliar para generar hash SHA-256 determinista
function generatePayloadHash(data: object): string {
  const canonicalJson = JSON.stringify(sortObjectRecursively(data));
  return createHash('sha256').update(canonicalJson).digest('hex');
}

// Ordena las claves de objetos recursivamente
function sortObjectRecursively(obj: any): any {
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
