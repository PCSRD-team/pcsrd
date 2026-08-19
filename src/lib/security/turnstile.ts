import { serverEnv } from '@/lib/env';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Server-side Turnstile verification.
 *
 * Fails **closed**: a network error, a timeout or a malformed response all
 * return `false`. A captcha that silently passes when Cloudflare is unreachable
 * is not a captcha, and the six forms behind it are exactly what a spam run
 * would target.
 */
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  if (!token) return false;

  const body = new FormData();
  body.append('secret', serverEnv.TURNSTILE_SECRET_KEY);
  body.append('response', token);
  if (ip && ip !== 'unknown') body.append('remoteip', ip);

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
