/** Data Encryption - Kenya Farm IoT */

/**
 * Sensitive fields encrypted at rest (AES-256-GCM):
 * - users.password_hash (bcrypt, not reversible)
 * - farmers.phone (optional field-level encryption)
 * - PII in audit_logs.metadata
 *
 * Environment:
 * - ENCRYPTION_KEY: 32-byte hex key for AES-256
 * - DB: PostgreSQL TDE, MongoDB encryption at rest
 * - Transit: TLS 1.3
 */

export const ENCRYPTED_FIELDS = [
  'phone',
  'email_hash',
  'metadata.pii',
];
