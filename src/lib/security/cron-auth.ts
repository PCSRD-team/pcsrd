import { timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/lib/env';

/**
 * Authorises a cron request.
 *
 * The two cron routes compared the header with `!==`, which short-circuits on
 * the first differing byte. That leaks the secret's prefix through response
 * timing to anyone who can call the endpoint — and both endpoints are public
 * URLs on the deployed site. One of them runs the retention purge, so guessing
 * `CRON_SECRET` is a way to delete every submission past its deadline early,
 * and the other is a write.
 *
 * The attack is not cheap over the internet and it is not theoretical either;
 * `timingSafeEqual` costs nothing and removes the question.
 *
 * Two details matter for it to actually be constant-time:
 *
 * - `timingSafeEqual` **throws** when the buffers differ in length, which would
 *   itself be a length oracle. Both sides are hashed to a fixed 32 bytes first,
 *   so the comparison always runs over the same width whatever was sent.
 * - The comparison runs even when the header is missing, so an absent header
 *   and a wrong one take the same path.
 */
async function sha256(value: string): Promise<Buffer> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Buffer.from(digest);
}

export async function isAuthorisedCron(request: Request): Promise<boolean> {
  const presented = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${serverEnv.CRON_SECRET}`;
  const [a, b] = await Promise.all([sha256(presented), sha256(expected)]);
  return timingSafeEqual(a, b);
}
