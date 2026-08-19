import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { serverEnv } from '@/lib/env';

/**
 * AES-256-GCM for sensitive submission payloads.
 *
 * `form_submissions.payload_encrypted` exists so that a database dump of a
 * protection complaint is inert on its own. The plaintext `payload` column
 * stays `null` for those rows.
 *
 * Layout of the stored buffer:
 *
 *     [ 12-byte IV ][ 16-byte auth tag ][ ciphertext ]
 *
 * The IV is random per record — reusing one across records under the same key
 * is the failure mode that breaks GCM completely, so it is generated here and
 * never passed in. `payload_key_id` records which key was used, which is what
 * makes rotation possible without a migration.
 */

const IV_BYTES = 12;
const TAG_BYTES = 16;

function key(): Buffer {
  return Buffer.from(serverEnv.SUBMISSION_ENC_KEY, 'hex');
}

export function encryptPayload(payload: unknown): { data: Buffer; keyId: string } {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    data: Buffer.concat([iv, cipher.getAuthTag(), ciphertext]),
    keyId: serverEnv.SUBMISSION_ENC_KEY_ID,
  };
}

export function decryptPayload<T = Record<string, unknown>>(blob: Buffer): T {
  const iv = blob.subarray(0, IV_BYTES);
  const tag = blob.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = blob.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8')) as T;
}
