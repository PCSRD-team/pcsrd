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

    expect(await checkRateLimit('form', 'abc')).toEqual({ success: true, retryAfterSeconds: 0, degraded: false });
    expect(await checkRateLimit('upload', 'abc')).toEqual({ success: true, retryAfterSeconds: 0, degraded: false });
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

/**
 * The behaviour the outage of 2026-09-19 exposed.
 *
 * `cached[key].limit()` had no `try/catch`, so a fetch failure escaped
 * `checkRateLimit`, escaped `submit()`, and reached `runAction` as an
 * unexpected throw — which meant all six public forms answered "Something went
 * wrong" and nothing reported it. Upstash is mocked here to throw; what is
 * under test is that the throw is contained, that the database is consulted,
 * and that the caller is told the limiter is degraded.
 */
const captureException = vi.fn();

async function loadWithFailingUpstash(dbAnswer: boolean | null | 'throw') {
  captureException.mockClear();
  vi.resetModules();
  vi.doMock('@/lib/env', () => ({
    serverEnv: {
      NODE_ENV: 'production',
      UPSTASH_REDIS_REST_URL: 'https://gone.upstash.invalid',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    },
  }));
  // Mocked so the assertion below can see the report, and so a cold run does
  // not pay for the real SDK's module graph inside a 5s test timeout.
  vi.doMock('@sentry/nextjs', () => ({ captureException }));
  vi.doMock('@upstash/redis', () => ({ Redis: class {} }));
  vi.doMock('@upstash/ratelimit', () => ({
    Ratelimit: class {
      static slidingWindow = () => undefined;
      limit = () => Promise.reject(new Error('getaddrinfo ENOTFOUND gone.upstash.invalid'));
    },
  }));
  vi.doMock('@/db', () => ({
    db: {
      execute: () =>
        dbAnswer === 'throw'
          ? Promise.reject(new Error('connection refused'))
          : Promise.resolve({ rows: [{ ok: dbAnswer }] }),
    },
  }));
  return import('@/lib/security/rate-limit');
}

describe('checkRateLimit when Upstash is unreachable', () => {
  it('falls back to the database and permits a client inside its allowance', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { checkRateLimit } = await loadWithFailingUpstash(true);

    const result = await checkRateLimit('form', 'abc');
    expect(result.success).toBe(true);
    expect(result.degraded).toBe(true);
  });

  it('still refuses a client the database says is over its allowance', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { checkRateLimit } = await loadWithFailingUpstash(false);

    const result = await checkRateLimit('form', 'abc');
    expect(result.success).toBe(false);
    expect(result.degraded).toBe(true);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('refuses, rather than throwing, when neither backend can answer', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { checkRateLimit } = await loadWithFailingUpstash('throw');

    // The contract that matters: it resolves. A throw here is what took the
    // forms down, because `runAction` turns it into `errors.unexpected`.
    const result = await checkRateLimit('form', 'abc');
    expect(result.success).toBe(false);
    expect(result.degraded).toBe(true);
  });

  it('reports the outage to Sentry, tagged so an alert can route on it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { checkRateLimit } = await loadWithFailingUpstash(true);
    await checkRateLimit('form', 'abc');

    // The report is deliberately not awaited by the request path, so this
    // waits for it rather than assuming it has already happened.
    await vi.waitFor(() => expect(captureException).toHaveBeenCalled());
    expect(captureException.mock.calls[0]?.[1]).toMatchObject({
      tags: { area: 'rate-limit', backend: 'upstash' },
    });
  });

  it('logs the outage instead of absorbing it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { checkRateLimit } = await loadWithFailingUpstash(true);
    await checkRateLimit('form', 'abc');

    expect(error).toHaveBeenCalled();
    expect(error.mock.calls.map((c) => String(c[0])).join(' ')).toMatch(/Upstash is unreachable/);
  });
});
