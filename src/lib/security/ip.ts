import { createHash } from 'node:crypto';
import { serverEnv } from '@/lib/env';

/**
 * Hashes a client IP for abuse correlation.
 *
 * A raw address is never stored. The salt is required to be at least 32 bytes
 * by `env.ts`, because a short salt turns a 32-bit address space into something
 * a laptop reverses in seconds — at which point the hash is decoration.
 *
 * Sensitive submissions do not call this at all: the submission service writes
 * `null`. See `services/submission`.
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`${ip}${serverEnv.IP_HASH_SALT}`).digest('hex');
}

/**
 * Reads the client address from proxy headers.
 *
 * `x-forwarded-for` is a comma-separated chain and the **first** entry is the
 * original client; taking the last would record Vercel's own edge node.
 */
export function clientIpFrom(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip');
}

/**
 * The request's client address, from the Next request scope.
 *
 * Split from `clientIpFrom` so the parsing rule stays a pure function that a
 * unit test can exercise without a request — `headers()` throws outside one.
 */
export async function getClientIp(): Promise<string> {
  const { headers } = await import('next/headers');
  return clientIpFrom(await headers()) ?? 'unknown';
}
