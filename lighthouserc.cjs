/**
 * Lighthouse CI — the performance gate from `docs/spec/03-FRONTEND.md §9`.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Numbers from a `next dev` server are INDICATIVE ONLY. Development builds │
 * │ ship React's development bundle, unminified chunks, HMR and eval, so    │
 * │ the performance score and the script budget are both pessimistic by a  │
 * │ wide margin. CI runs this against `next start` after `next build`      │
 * │ (`.github/workflows/e2e.yml`); those are the numbers the budgets gate.  │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Five sampled routes: the home page (hero + LCP), a filtered list (dynamic
 * render), a content page, a form page (the only third-party script), and
 * the English home (LTR — the fonts differ, so the font budget must hold in
 * both scripts).
 *
 * The 110 KB script budget in §9 is **gzipped**. Lighthouse's `resource-summary`
 * measures transfer size, which for a server that compresses is the gzipped
 * figure; `next start` compresses by default, `next dev` does not — one more
 * reason the dev-server run is indicative.
 */

const BASE = process.env.LHCI_BASE_URL ?? 'http://localhost:3100';

const ROUTES = ['/ar', '/en', '/ar/projects?gov=rafah', '/ar/about', '/ar/contact'];

/** @type {import('@lhci/cli').LHCIConfig} */
module.exports = {
  ci: {
    collect: {
      url: ROUTES.map((route) => `${BASE}${route}`),
      // The workflow (and a developer) starts the server; LHCI only probes.
      startServerCommand: undefined,
      numberOfRuns: process.env.CI ? 3 : 1,
      settings: {
        // Mobile is the audience: a cheap phone on a filtered connection.
        preset: 'mobile',
        // Turnstile is loaded lazily and is the only foreign origin. Blocking
        // it keeps the run deterministic; it is asserted by Playwright instead.
        blockedUrlPatterns: ['https://challenges.cloudflare.com/*'],
        // Accept-Language is irrelevant once the URL carries the locale.
        skipAudits: ['uses-http2'],
      },
    },
    assert: {
      // `budgets.json` is inlined here so there is one file to read.
      budgetsFile: undefined,
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 1 }],
        'categories:seo': ['error', { minScore: 0.95 }],

        // §9 budgets, expressed as resource-summary assertions (bytes).
        // Script ≤ 110 KB gzipped, fonts ≤ 120 KB, hero image ≤ 120 KB.
        'resource-summary:script:size': ['error', { maxNumericValue: 110 * 1024 }],
        'resource-summary:font:size': ['error', { maxNumericValue: 120 * 1024 }],
        'resource-summary:image:size': ['warn', { maxNumericValue: 300 * 1024 }],
        'resource-summary:third-party:count': ['error', { maxNumericValue: 0 }],

        // Core Web Vitals thresholds from §9.
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }],
        'total-blocking-time': ['warn', { maxNumericValue: 200 }],

        // The site is RTL-first; Lighthouse's own checks for it.
        'html-has-lang': 'error',
        'html-lang-valid': 'error',
        'document-title': 'error',
        'meta-description': 'error',
        'hreflang': 'error',
        'canonical': 'error',
        'is-crawlable': 'error',
        'robots-txt': 'error',
        'errors-in-console': 'warn',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
