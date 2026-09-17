import { createCipheriv, randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { decryptPayload, encryptPayload, hasKey, keyVariableFor } from '@/lib/security/crypto';

/**
 * The key ring. `tests/setup/env.ts` pins the current key
 * (`SUBMISSION_ENC_KEY`, id `test`); older keys are looked up by id from
 * `SUBMISSION_ENC_KEY_<id>`, which is what makes rotation possible without
 * touching a stored row.
 */

const OLD_ID = 'k0';
const OLD_KEY_HEX = 'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';

/** Encrypts the way the app did under a previous key, to simulate an old row. */
function encryptWith(hex: string, payload: unknown): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(hex, 'hex'), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

afterEach(() => {
  delete process.env[keyVariableFor(OLD_ID)];
});

describe('encryptPayload / decryptPayload', () => {
  it('round-trips under the current key and stamps its id', () => {
    const { data, keyId } = encryptPayload({ category: 'safeguarding', description: 'x' });
    expect(keyId).toBe(process.env.SUBMISSION_ENC_KEY_ID);
    expect(data.toString('utf8')).not.toContain('safeguarding');
    expect(decryptPayload(data)).toEqual({ category: 'safeguarding', description: 'x' });
    expect(decryptPayload(data, keyId)).toEqual({ category: 'safeguarding', description: 'x' });
    // A null `payload_key_id` on an old row falls back to the current key.
    expect(decryptPayload(data, null)).toEqual({ category: 'safeguarding', description: 'x' });
  });

  it('decrypts a row written under a retired key by its id', () => {
    const old = encryptWith(OLD_KEY_HEX, { description: 'older complaint' });

    // Not on the ring: the current key cannot open it, and the id is unknown.
    expect(() => decryptPayload(old)).toThrow();
    expect(hasKey(OLD_ID)).toBe(false);
    expect(() => decryptPayload(old, OLD_ID)).toThrow(new RegExp(keyVariableFor(OLD_ID)));

    // On the ring: opens by id, and only by that id.
    process.env[keyVariableFor(OLD_ID)] = OLD_KEY_HEX;
    expect(hasKey(OLD_ID)).toBe(true);
    expect(decryptPayload(old, OLD_ID)).toEqual({ description: 'older complaint' });
    expect(() => decryptPayload(old)).toThrow();
  });

  it('refuses a malformed ring entry and the reserved id', () => {
    process.env[keyVariableFor(OLD_ID)] = 'not-hex';
    expect(() => decryptPayload(encryptPayload({}).data, OLD_ID)).toThrow(/64 hex/);
    expect(hasKey('ID')).toBe(false);
    expect(hasKey('')).toBe(false);
  });
});
