import { defineConfig, devices } from '@playwright/test';
import type { E2EOptions } from './tests/e2e/fixtures';

/**
 * Real-browser tests — `docs/spec/06-BUILD-PLAN.md §10`.
 *
 * Five projects, each with one job:
 *
 * | project       | what it proves                                                   |
 * |---------------|------------------------------------------------------------------|
 * | `chromium-ar` | every locale-parametrised spec in the **default** locale, RTL    |
 * | `chromium-en` | the same specs in English, LTR                                   |
 * | `chromium`    | specs that loop both locales themselves (forms, admin, security, |
 * |               | visual) — run once, not once per locale project                  |
 * | `no-js`       | the six public forms and the admin login with JavaScript off —   |
 * |               | non-negotiable #7, "every form works with JavaScript disabled"   |
 * | `mobile`      | 375px overflow checks on every route (`@mobile`-tagged tests)    |
 *
 * `PORT` is fixed at 3100 so a developer's `next dev` on 3000 and the test
 * server never collide. `reuseExistingServer` means a server already on 3100
 * is used as-is — which is how the suite runs against a hand-started server.
 *
 * `CI` switches `next dev` for `next start`: the workflow builds first, and
 * Lighthouse numbers from a dev server are not the numbers that matter.
 */

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

const LOCALE_SPECS = ['shell', 'routes', 'a11y', 'journeys'].map((name) => `**/${name}.spec.ts`);
const SHARED_SPECS = ['forms', 'admin', 'security', 'visual'].map((name) => `**/${name}.spec.ts`);

export default defineConfig<E2EOptions>({
  testDir: './tests/e2e',
  // Baselines live next to the specs, keyed by platform: font rasterisation
  // differs between Windows and Linux, so a Windows baseline can never be
  // compared with a CI (Linux) screenshot.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{arg}-{platform}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  // The dev server compiles routes on first hit; a burst of parallel first
  // hits makes every one of them slow. Two workers is the sweet spot locally.
  workers: process.env.CI ? 2 : 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      // Dynamic content is masked in the spec; the ratio absorbs sub-pixel
      // anti-aliasing drift, not layout change.
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    // A first-hit dev-server compile of a heavy route can take >30s.
    navigationTimeout: 60_000,
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium-ar',
      testMatch: LOCALE_SPECS,
      grepInvert: /@mobile/,
      use: {
        ...devices['Desktop Chrome'],
        locale: 'ar',
        siteLocale: 'ar',
        extraHTTPHeaders: { 'Accept-Language': 'ar' },
      },
    },
    {
      name: 'chromium-en',
      testMatch: LOCALE_SPECS,
      grepInvert: /@mobile/,
      use: {
        ...devices['Desktop Chrome'],
        locale: 'en-GB',
        siteLocale: 'en',
        extraHTTPHeaders: { 'Accept-Language': 'en' },
      },
    },
    {
      name: 'chromium',
      testMatch: SHARED_SPECS,
      use: {
        ...devices['Desktop Chrome'],
        locale: 'ar',
        siteLocale: 'ar',
      },
    },
    {
      name: 'no-js',
      testMatch: ['**/forms.spec.ts', '**/admin.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        javaScriptEnabled: false,
        locale: 'ar',
        siteLocale: 'ar',
      },
    },
    {
      name: 'mobile',
      testMatch: LOCALE_SPECS,
      grep: /@mobile/,
      use: {
        ...devices['Pixel 5'],
        // Pixel 5 is 393px wide; the budget in the brief is 375px, so the
        // narrower iPhone-class viewport is used with the Pixel's UA.
        viewport: { width: 375, height: 812 },
        locale: 'ar',
        siteLocale: 'ar',
      },
    },
  ],
  webServer: {
    command: process.env.CI
      ? `npx next start --port ${PORT}`
      : `npx next dev --port ${PORT}`,
    // `robots.txt` has no database dependency; `/api/health` answers 503 when the
    // database is unreachable and Playwright would wait on it forever.
    url: `${BASE_URL}/robots.txt`,
    // Always reuse: locally that is the hand-started dev server, and in CI the
    // workflow starts `next start` once so Lighthouse can use the same one.
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
