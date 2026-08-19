import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { serverEnv } from '@/lib/env';

/**
 * Sliding-window limits per client (02-API §5.1).
 *
 * Created lazily. Building the Redis client at module load would make every
 * import of this file — including from a unit test that never rate-limits —
 * require `UPSTASH_*` to be present.
 */
let cached: ReturnType<typeof build> | null = null;

function build() {
  const redis = new Redis({
    url: serverEnv.UPSTASH_REDIS_REST_URL,
    token: serverEnv.UPSTASH_REDIS_REST_TOKEN,
  });
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

export type LimiterKey = 'form' | 'upload' | 'global';

export type RateLimitResult = { success: boolean; retryAfterSeconds: number };

export async function checkRateLimit(key: LimiterKey, id: string): Promise<RateLimitResult> {
  cached ??= build();
  const { success, reset } = await cached[key].limit(id);
  return { success, retryAfterSeconds: Math.max(0, Math.ceil((reset - Date.now()) / 1000)) };
}
