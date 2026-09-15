import { describe, expect, it } from 'vitest';
import { buildAdminCsp, buildSiteCsp, sentryIngestOrigin } from '@/lib/security/csp';

/**
 * These exist because of one bug and one risk.
 *
 * The bug: the CSP was a single constant for every environment, so
 * `npm run dev` failed with "eval() is not supported in this environment" —
 * React's development bundle calls `eval()` and the policy forbade it.
 *
 * The risk introduced by fixing it: `'unsafe-eval'` in a *deployed* policy would
 * undo most of what the header is for, and on the admin it would hollow out the
 * nonce completely. "It is behind an isDev check" is an argument. This is a
 * guarantee.
 */

const PROD_FORBIDDEN = ["'unsafe-eval'", 'ws:', 'wss:'];

describe('production CSP', () => {
  it('never allows eval or a websocket on the public site', () => {
    const csp = buildSiteCsp(false);
    for (const token of PROD_FORBIDDEN) expect(csp).not.toContain(token);
  });

  it('never allows eval or a websocket on the admin', () => {
    const csp = buildAdminCsp('abc123', false);
    for (const token of PROD_FORBIDDEN) expect(csp).not.toContain(token);
  });

  it('upgrades insecure requests', () => {
    expect(buildSiteCsp(false)).toContain('upgrade-insecure-requests');
    expect(buildAdminCsp('abc123', false)).toContain('upgrade-insecure-requests');
  });

  it('keeps the admin nonce and strict-dynamic', () => {
    const csp = buildAdminCsp('abc123', false);
    expect(csp).toContain("'nonce-abc123'");
    expect(csp).toContain("'strict-dynamic'");
  });

  it('never allows a framing ancestor or an object', () => {
    for (const csp of [buildSiteCsp(false), buildAdminCsp('n', false)]) {
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
    }
  });

  it('does not put unsafe-inline in the admin script-src', () => {
    // The public site needs it for Next's RSC bootstrap; the admin uses a nonce
    // precisely so it does not, and `'unsafe-inline'` there would be ignored by
    // browsers that honour the nonce and honoured by those that do not.
    const scriptSrc = buildAdminCsp('n', false)
      .split('; ')
      .find((d) => d.startsWith('script-src'));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });
});

describe('development CSP', () => {
  it('allows eval, because React needs it to build a component stack', () => {
    expect(buildSiteCsp(true)).toContain("'unsafe-eval'");
    expect(buildAdminCsp('n', true)).toContain("'unsafe-eval'");
  });

  it('allows the hot-reload socket', () => {
    expect(buildSiteCsp(true)).toContain('ws:');
    expect(buildAdminCsp('n', true)).toContain('ws:');
  });

  it('omits upgrade-insecure-requests, which would break that socket', () => {
    expect(buildSiteCsp(true)).not.toContain('upgrade-insecure-requests');
    expect(buildAdminCsp('n', true)).not.toContain('upgrade-insecure-requests');
  });
});

describe('Sentry ingest origin', () => {
  const DSN = 'https://0123456789abcdef@o4500000000000000.ingest.de.sentry.io/4500000000000001';
  const ORIGIN = 'https://o4500000000000000.ingest.de.sentry.io';

  it('derives exactly the ingest host from a DSN, never a wildcard', () => {
    expect(sentryIngestOrigin(DSN)).toBe(ORIGIN);
    expect(sentryIngestOrigin(undefined)).toBeNull();
    expect(sentryIngestOrigin('')).toBeNull();
    expect(sentryIngestOrigin('not a url')).toBeNull();
    expect(sentryIngestOrigin('http://key@insecure.example/1')).toBeNull();
  });

  it('names no tracker at all when the DSN is unset', () => {
    for (const csp of [buildSiteCsp(false, null), buildAdminCsp('n', false, null)]) {
      expect(csp).not.toContain('sentry');
    }
  });

  it('adds the origin to connect-src only, and to nothing else', () => {
    for (const csp of [buildSiteCsp(false, ORIGIN), buildAdminCsp('n', false, ORIGIN)]) {
      const directives = csp.split('; ');
      const withSentry = directives.filter((d) => d.includes(ORIGIN));
      expect(withSentry).toHaveLength(1);
      expect(withSentry[0]).toMatch(/^connect-src /);
      // The SDK is bundled, not a script tag: script-src must not grow.
      expect(directives.find((d) => d.startsWith('script-src'))).not.toContain('sentry');
    }
  });
});
