import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { serverEnv } from '@/lib/env';

/**
 * Sliding-window limits per client (02-API §5.1).
 *
 *   form    5 / hour   every public form except the one with a file
 *   upload  3 / hour   the job application (it writes to storage)
 *   global 30 / hour   everything a single client may do
 *
 * Created lazily. Building the Redis client at module load would make every
 * import of this file — including from a unit test that never rate-limits —
 * require `UPSTASH_*` to be present.
 *
 * The id a caller passes should already be opaque — `hashIp(ip)`, not the
 * address itself — so the window key written to Upstash carries nothing a
 * third party could correlate with a person. The limiter does not hash on the
 * caller's behalf because the same function also keys on actor ids.
 */

export type LimiterKey = 'form' | 'upload' | 'global';

export type RateLimitResult = { success: boolean; retryAfterSeconds: number };

type Limiters = Record<LimiterKey, Ratelimit>;

/**
 * `null` means "no limiter" — permitted in development only, so a developer
 * without an Upstash database can still exercise the forms. In production and
 * under test the absence is an error: a rate limiter that silently vanishes
 * when its config is missing is the kind of failure nobody notices until the
 * inbox is full.
 */
let cached: Limiters | null | undefined;

function build(): Limiters | null {
  const url = serverEnv.UPSTASH_REDIS_REST_URL;
  const token = serverEnv.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (serverEnv.NODE_ENV !== 'development') {
      throw new Error(
        'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required outside development.',
      );
    }
    console.warn(
      '[rate-limit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are unset; ' +
        'rate limiting is DISABLED for this development process.',
    );
    return null;
  }

  const redis = new Redis({ url, token });
  return {
    form: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 h'),
      prefix: 'rl:form',
      analytics: false,
    }),
    upload: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '1 h'),
      prefix: 'rl:upload',
      analytics: false,
    }),
    global: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 h'),
      prefix: 'rl:global',
      analytics: false,
    }),
  };
}

export async function checkRateLimit(key: LimiterKey, id: string): Promise<RateLimitResult> {
  if (cached === undefined) cached = build();
  if (cached === null) return { success: true, retryAfterSeconds: 0 };

  const { success, reset } = await cached[key].limit(id);
  return { success, retryAfterSeconds: Math.max(0, Math.ceil((reset - Date.now()) / 1000)) };
}
