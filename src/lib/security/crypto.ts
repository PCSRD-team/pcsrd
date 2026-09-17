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
 *
 * ## The key ring
 *
 * Encryption always uses the **current** key, `SUBMISSION_ENC_KEY`, and stamps
 * the row with `SUBMISSION_ENC_KEY_ID`. Decryption selects a key by the row's
 * `payload_key_id`:
 *
 *   - the current id → `SUBMISSION_ENC_KEY`
 *   - any other id   → `SUBMISSION_ENC_KEY_<id>`, read from the environment
 *
 * So rotating is: move the old value to `SUBMISSION_ENC_KEY_<old id>`, put the
 * new value in `SUBMISSION_ENC_KEY`, bump `SUBMISSION_ENC_KEY_ID`, deploy.
 * Old complaints stay readable; new ones use the new key; nothing is
 * re-encrypted and no migration runs (RUNBOOK §4). A retired key may be
 * removed from the environment once every row that names it has been purged
 * by retention.
 *
 * Older keys are read from `process.env` directly rather than through
 * `env.ts`: their names are data, not a fixed schema, and the shape check
 * that matters (64 hex characters) is applied here at the point of use.
 */

const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEX_KEY = /^[0-9a-f]{64}$/i;

/** `SUBMISSION_ENC_KEY_ID` is the id variable, not a key named "ID". */
const RESERVED_IDS = new Set(['ID']);

/** The environment variable that would hold the key for `keyId`. */
export function keyVariableFor(keyId: string): string {
  return `SUBMISSION_ENC_KEY_${keyId}`;
}

function keyFor(keyId: string): Buffer {
  if (keyId === serverEnv.SUBMISSION_ENC_KEY_ID) {
    return Buffer.from(serverEnv.SUBMISSION_ENC_KEY, 'hex');
  }
  if (!keyId || RESERVED_IDS.has(keyId.toUpperCase())) {
    throw new Error(`Invalid payload key id "${keyId}".`);
  }

  const name = keyVariableFor(keyId);
  const hex = process.env[name] ?? process.env[name.toUpperCase()];
  if (!hex) {
    throw new Error(
      `No key for payload_key_id "${keyId}". Set ${name} to the key that encrypted it.`,
    );
  }
  if (!HEX_KEY.test(hex)) {
    throw new Error(`${name} must be 32 bytes as 64 hex characters.`);
  }
  return Buffer.from(hex, 'hex');
}

/** Whether a row stamped `keyId` can be decrypted in this environment. */
export function hasKey(keyId: string): boolean {
  try {
    keyFor(keyId);
    return true;
  } catch {
    return false;
  }
}

export function encryptPayload(payload: unknown): { data: Buffer; keyId: string } {
  const keyId = serverEnv.SUBMISSION_ENC_KEY_ID;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', keyFor(keyId), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    data: Buffer.concat([iv, cipher.getAuthTag(), ciphertext]),
    keyId,
  };
}

/**
 * Decrypts a stored payload with the key named by `keyId` — the row's
 * `payload_key_id`. Defaults to the current key so an older caller keeps
 * working, but a caller that has the row should always pass the id: after a
 * rotation the default is wrong for every row written before it.
 */
export function decryptPayload<T = Record<string, unknown>>(
  blob: Buffer,
  keyId: string | null | undefined = serverEnv.SUBMISSION_ENC_KEY_ID,
): T {
  const iv = blob.subarray(0, IV_BYTES);
  const tag = blob.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = blob.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv('aes-256-gcm', keyFor(keyId ?? serverEnv.SUBMISSION_ENC_KEY_ID), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8')) as T;
}
