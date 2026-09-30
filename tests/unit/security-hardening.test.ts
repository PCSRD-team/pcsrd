import { afterEach, describe, expect, it, vi } from 'vitest';
import { organizationSchema, partnerSchema, redirectSchema } from '@/lib/validation/admin';

/**
 * Security review, 2026-09-29: the input rules that keep a CMS field from
 * becoming a script URL or an open redirect, and the limiter's timeout path.
 */

vi.mock('@/db/queries/redirects', () => ({ listRedirectRules: async () => [] }));

describe('CMS links accept only web schemes', () => {
  const website = partnerSchema.shape.website;

  it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>1</script>', 'vbscript:x', 'http:example.org'])(
    'refuses %s',
    (value) => {
      expect(website.safeParse(value).success).toBe(false);
      expect(organizationSchema.safeParse({ footerCtaUrl: value }).success).toBe(false);
      expect(
        organizationSchema.safeParse({ socials: [{ platform: 'x', url: value }] }).success,
      ).toBe(false);
    },
  );

  it('accepts http and https', () => {
    expect(website.safeParse('https://example.org/about').success).toBe(true);
    expect(website.safeParse('http://example.org').success).toBe(true);
    expect(website.safeParse('').success).toBe(true);
    expect(organizationSchema.safeParse({ footerCtaUrl: 'https://example.org' }).success).toBe(true);
  });

  it('lets an official channel be a mailto address, and nothing else new', () => {
    const channel = (url: string) =>
      organizationSchema.safeParse({ officialChannels: [{ platform: 'email', handle: 'h', url }] }).success;
    expect(channel('mailto:info@example.org')).toBe(true);
    expect(channel('https://example.org')).toBe(true);
    expect(channel('javascript:alert(1)')).toBe(false);
    expect(channel('data:text/html,x')).toBe(false);
  });
});

describe('redirect paths', () => {
  const parse = (destinationPath: string) =>
    redirectSchema.safeParse({ sourcePath: '/old', destinationPath }).success;

  it('accepts an ordinary site path', () => {
    expect(parse('/ar/about')).toBe(true);
  });

  it.each(['//evil.com', '/\\evil.com', '/\\/evil.com', '/a\\b', 'https://evil.com', 'evil.com'])(
    'refuses %s',
    (value) => {
      expect(parse(value)).toBe(false);
    },
  );
});

describe('proxy isSafeDestination', () => {
  const base = 'https://pcsrd.example/ar/old';

  it('follows a same-origin path and an https URL', async () => {
    const { isSafeDestination } = await import('@/proxy');
    expect(isSafeDestination('/ar/new', base)).toBe(true);
    expect(isSafeDestination('https://partner.example/x', base)).toBe(true);
  });

  it.each(['//evil.com', '/\\evil.com', '/\\\\evil.com', '/\tevil', 'http://evil.com', 'javascript:alert(1)', 'evil.com'])(
    'refuses %s',
    async (value) => {
      const { isSafeDestination } = await import('@/proxy');
      expect(isSafeDestination(value, base)).toBe(false);
    },
  );
});

/**
 * `@upstash/ratelimit` resolves `{ success: true, reason: 'timeout' }` when its
 * timeout fires instead of throwing, so a hanging Upstash used to allow every
 * request. It must be treated as an outage and fall back to the database.
 */
describe('checkRateLimit when Upstash times out', () => {
  afterEach(() => {
    vi.doUnmock('@/lib/env');
    vi.doUnmock('@upstash/redis');
    vi.doUnmock('@upstash/ratelimit');
    vi.doUnmock('@/db');
    vi.doUnmock('@sentry/nextjs');
    vi.restoreAllMocks();
  });

  it('consults the database and reports degraded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.resetModules();
    vi.doMock('@/lib/env', () => ({
      serverEnv: { NODE_ENV: 'production', UPSTASH_REDIS_REST_URL: 'https://x.upstash.io', UPSTASH_REDIS_REST_TOKEN: 't' },
    }));
    vi.doMock('@sentry/nextjs', () => ({ captureException: () => undefined }));
    vi.doMock('@upstash/redis', () => ({ Redis: class {} }));
    vi.doMock('@upstash/ratelimit', () => ({
      Ratelimit: class {
        static slidingWindow = () => undefined;
        limit = () => Promise.resolve({ success: true, limit: 0, remaining: 0, reset: 0, reason: 'timeout' });
      },
    }));
    const execute = vi.fn(() => Promise.resolve({ rows: [{ ok: false }] }));
    vi.doMock('@/db', () => ({ db: { execute } }));

    const { checkRateLimit } = await import('@/lib/security/rate-limit');
    const result = await checkRateLimit('form', 'abc');

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.degraded).toBe(true);
  });
});
