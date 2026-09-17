import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The limiter's behaviour when Upstash is not configured: a no-op with a
 * warning in development, an error everywhere else. The Redis client is never
 * built in either case, so nothing here touches the network.
 */

async function loadWith(env: Record<string, string | undefined>) {
  vi.resetModules();
  vi.doMock('@/lib/env', () => ({ serverEnv: env }));
  return import('@/lib/security/rate-limit');
}

afterEach(() => {
  vi.doUnmock('@/lib/env');
  vi.restoreAllMocks();
});

describe('checkRateLimit without Upstash credentials', () => {
  it('is a warned no-op in development', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { checkRateLimit } = await loadWith({ NODE_ENV: 'development' });

    expect(await checkRateLimit('form', 'abc')).toEqual({ success: true, retryAfterSeconds: 0 });
    expect(await checkRateLimit('upload', 'abc')).toEqual({ success: true, retryAfterSeconds: 0 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/DISABLED/);
  });

  it('refuses to run in production', async () => {
    const { checkRateLimit } = await loadWith({ NODE_ENV: 'production' });
    await expect(checkRateLimit('form', 'abc')).rejects.toThrow(/UPSTASH_REDIS_REST_URL/);
  });

  it('refuses to run under test', async () => {
    const { checkRateLimit } = await loadWith({
      NODE_ENV: 'test',
      UPSTASH_REDIS_REST_URL: 'https://x.upstash.io',
    });
    await expect(checkRateLimit('form', 'abc')).rejects.toThrow(/required outside development/);
  });
});
