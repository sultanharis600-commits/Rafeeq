import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for data encrypted at rest (IBANs, document references).
 * Key: DATA_ENCRYPTION_KEY (32 bytes, base64). In development without a key, one is
 * derived from JWT_SECRET so the demo works; production refuses to start without it.
 */
export function encryptionKey(dataKey: string | undefined, jwtSecret: string, production: boolean): Buffer {
  if (dataKey) {
    const key = Buffer.from(dataKey, 'base64');
    if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
    return key;
  }
  if (production) throw new Error('DATA_ENCRYPTION_KEY is required in production');
  return createHash('sha256').update(`dev-data-key:${jwtSecret}`).digest();
}

export function encrypt(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function decrypt(payload: string, key: Buffer): string {
  const [v, iv, tag, data] = payload.split(':');
  if (v !== 'v1') throw new Error('Unknown ciphertext version');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

/** Saudi IBAN: SA + 22 digits. */
export const SAUDI_IBAN = /^SA\d{22}$/;
export const ibanLast4 = (iban: string) => iban.slice(-4);

/** Binary variant for files: [12-byte IV][16-byte tag][ciphertext]. */
export function encryptBuffer(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]);
}

export function decryptBuffer(payload: Buffer, key: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key, payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]);
}
