// src/services/pep.ts
//import { evaluatePolicy, PDPAttributes } from './pdp';
import { evaluatePolicy, PDPAttributes } from './pdp-production';
import { z } from 'zod';
import { createHash } from 'crypto';
import logger from '../utils/logging';

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
      operation: 'EMAIL_OPERATION',
      reason: validation.error.message,
      validation_errors: validation.error.errors?.length || 0
    });
    return {
      allowed: false,
      reason: 'Schema validation failed'
    };
  }

  const validated = validation.data;
  
  // SECURE: Only log payload details in verbose mode
  logger.debug('Email payload validated', {
    operation: 'EMAIL_OPERATION',
    recipient_domain: validated.to.split('@')[1],
    subject_length: validated.subject.length,
    body_length: validated.body.length,
    attachments_count: validated.attachments?.length || 0,
    attachment_names: validated.attachments?.map(a => a.name) || [],
    // VERBOSE ONLY: Full payload for debugging
    ...(logger.isVerbose() && {
      verbose_validated_payload: validated
    })
  });

  // 2. Ordenar y hashear el payload de forma determinista
  const hash = generatePayloadHash(validated);
  
  logger.debug('Payload hash generated', {
    operation: 'EMAIL_OPERATION',
    hash,
    hash_algorithm: 'SHA-256',
    payload_keys: Object.keys(validated)
  });

  // 3. Atributos para PDP (modo estricto)
  const attributes: PDPAttributes = {
    gdpr_token,
    payload_hash: hash,
    subject: validated.to,
    purpose: 'email_notification',
    //expiration: undefined, // future: from consent registry
    user_id: process.env.TENANT_CLIENT_ID
  };

  // 4. Consulta a PDP
  const decision = evaluatePolicy(attributes);

  // 5. Logging estructurado con información de decisión
  logger.info('ABAC decision evaluated', {
    operation: 'EMAIL_OPERATION',
    user_id: process.env.TENANT_CLIENT_ID,
    hash,
    decision_allowed: decision.allow,
    decision_reason: decision.reason,
    gdpr_token_length: gdpr_token?.length || 0,
    purpose: attributes.purpose,
    // VERBOSE ONLY: Full decision details
    ...(logger.isVerbose() && {
      verbose_full_attributes: attributes,
      verbose_full_decision: decision,
      verbose_gdpr_token: gdpr_token
    })
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