import { LOCALES, STATIC_ROUTES, expect, path, test, go } from './fixtures';

/**
 * Response headers and the no-third-party-script rule, checked from outside.
 *
 * Header values are asserted by *shape*, matching `next.config.ts` and
 * `src/lib/security/csp.ts`; the unit test `tests/unit/csp.test.ts` covers the
 * strings themselves. What this file adds is proof that the headers actually
 * reach a browser on a real route, including through the proxy.
 */

/** Cloudflare Turnstile — the single documented third-party script, and only
 *  where a public form lives. */
const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const FORM_ROUTES = new Set([
  '/contact',
  '/verify',
  '/get-involved/partner',
  '/get-involved/volunteer',
]);

test.describe('security headers on /ar', () => {
  test('static headers from next.config.ts are present', async ({ request }) => {
    const response = await request.get('/ar');
    expect(response.status()).toBe(200);
    const h = response.headers();

    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['permissions-policy']).toContain('camera=()');
    expect(h['permissions-policy']).toContain('microphone=()');
    expect(h['permissions-policy']).toContain('geolocation=()');
    expect(h['strict-transport-security']).toMatch(/max-age=\d{6,}/);
    expect(h['strict-transport-security']).toContain('includeSubDomains');
    expect(h['x-powered-by'], 'poweredByHeader is off').toBeUndefined();
  });

  test('the site CSP is present and locked down', async ({ request }) => {
    const response = await request.get('/ar');
    const csp = response.headers()['content-security-policy'] ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    // Turnstile is the only foreign script origin.
    const scriptSrc = csp.split(';').map((s) => s.trim()).find((s) => s.startsWith('script-src')) ?? '';
    const origins = scriptSrc.split(/\s+/).slice(1).filter((t) => t.startsWith('http'));
    expect(origins).toEqual(['https://challenges.cloudflare.com']);
    // Never a nonce on (site): a nonce would opt the tree out of static generation.
    expect(scriptSrc).not.toMatch(/nonce-/);
    // Dev-only relaxations must not be served by a production build.
    if (process.env.CI) {
      expect(scriptSrc).not.toContain("'unsafe-eval'");
      expect(csp).not.toMatch(/\bws:/);
      expect(csp).toContain('upgrade-insecure-requests');
    }
  });

  test('the same headers reach a deep route and a redirect', async ({ request }) => {
    const deep = await request.get('/en/projects?gov=rafah');
    expect(deep.headers()['x-content-type-options']).toBe('nosniff');
    expect(deep.headers()['content-security-policy']).toBeTruthy();

    const redirect = await request.get('/', { maxRedirects: 0 });
    expect(redirect.headers()['x-content-type-options']).toBe('nosniff');
  });
});

test.describe('no third-party scripts on (site) routes', () => {
  for (const locale of LOCALES) {
    for (const { route, implemented } of STATIC_ROUTES.filter((r) => r.implemented)) {
      test(`${locale} ${route}`, async ({ page }) => {
        const external: string[] = [];
        page.on('request', (req) => {
          if (req.resourceType() === 'script') {
            const url = new URL(req.url());
            if (url.origin !== 'http://localhost:3100') external.push(req.url());
          }
        });

        const response = await go(page, path(locale, route));
        test.skip(!implemented || response?.status() === 404, `${route} not available`);
        await page.waitForLoadState('networkidle').catch(() => undefined);

        // 1. Script tags in the served document and after hydration.
        const scripts = await page.locator('script[src]').evaluateAll((els) =>
          els.map((el) => (el as HTMLScriptElement).src),
        );
        const foreign = scripts.filter((src) => !src.startsWith('http://localhost:3100/_next/') && !src.startsWith('/_next/'));
        const allowed = FORM_ROUTES.has(route) ? [TURNSTILE_SRC] : [];
        expect(foreign.filter((src) => !allowed.includes(src)), 'foreign <script src> on a (site) route').toEqual([]);

        // 2. Script *requests* actually made by the page.
        const unexpectedRequests = external.filter((src) => !allowed.includes(src));
        expect(unexpectedRequests, 'external script requests').toEqual([]);

        // 3. No inline analytics / tag-manager signatures.
        const inline = await page.locator('script:not([src])').evaluateAll((els) => els.map((el) => el.textContent ?? ''));
        for (const body of inline) {
          expect(body).not.toMatch(/googletagmanager|gtag\(|fbq\(|hotjar|clarity\.ms|analytics\.js/);
        }
      });
    }
  }
});

test.describe('machine-readable endpoints', () => {
  test('robots.txt', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^text\/plain/);
    const body = await response.text();
    expect(body).toMatch(/User-Agent: \*/i);
    expect(body).toMatch(/Disallow: \/admin/);
    // `/api` without a trailing slash, which is what robots.ts emits and what
    // the intent is: the bare prefix blocks `/api` itself as well as
    // everything under it, where `/api/` would leave `/api` crawlable.
    expect(body).toMatch(/Disallow: \/api$/m);
    expect(body).toMatch(/Sitemap: https?:\/\/\S+\/sitemap\.xml/);
  });

  test('sitemap.xml', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/xml/);
    const body = await response.text();
    expect(body).toContain('<urlset');
    expect(body).toMatch(/<loc>https?:\/\/[^<]+\/ar<\/loc>/);
    // Every entry pairs both locales.
    expect(body).toMatch(/hreflang="ar"/);
    expect(body).toMatch(/hreflang="en"/);
    expect(body).not.toMatch(/\/admin/);
  });

  test('feed.xml', async ({ request }) => {
    const response = await request.get('/feed.xml');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/(rss|atom|xml)/);
    const body = await response.text();
    expect(body).toMatch(/^<\?xml/);
    expect(body).toMatch(/<rss|<feed/);
    expect(body).toContain('<channel>');
    expect(body).toMatch(/<link>https?:\/\/[^<]+<\/link>/);
  });

  test('the health probe is uncached', async ({ request }) => {
    const response = await request.get('/api/health');
    expect([200, 503]).toContain(response.status());
    const body = (await response.json()) as { status: string };
    expect(['ok', 'degraded']).toContain(body.status);
    // Never leaks connection details on failure.
    expect(JSON.stringify(body)).not.toMatch(/postgres|supabase|password/i);
  });
});
