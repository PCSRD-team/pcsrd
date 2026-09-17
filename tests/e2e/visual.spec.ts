import type { Page } from '@playwright/test';
import { LOCALES, discoverDetail, expect, path, test, go } from './fixtures';

/**
 * Full-page screenshots in **both directions**. This is the RTL regression net
 * `docs/spec/06-BUILD-PLAN.md §10` asks for: a physical CSS property that
 * slips past the lint rule, a `start`/`end` swap, a scrollbar on the wrong
 * side — none of those fail a functional test, all of them change pixels.
 *
 * Baselines: `tests/e2e/__screenshots__/visual.spec.ts/<name>-<platform>.png`.
 * Regenerate with `npm run test:visual:update` after an intentional change,
 * and commit the result with the change that caused it.
 *
 * Dynamic content is masked rather than waited for: images come from a live
 * bucket, dates move, and the Turnstile widget is Cloudflare's. What is
 * compared is the layout.
 */

const MASK = [
  'img',
  'picture',
  'video',
  'iframe',
  'time',
  '.cf-turnstile',
  // The footer's copyright year and any impact count-ups.
  '[data-dynamic]',
];

async function settle(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
}

async function snapshot(page: Page, name: string) {
  await settle(page);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    mask: MASK.map((selector) => page.locator(selector)),
    maskColor: '#E5E2DA',
  });
}

for (const locale of LOCALES) {
  test.describe(`visual (${locale})`, () => {
    test('home', async ({ page }) => {
      await go(page, path(locale, '/'));
      await snapshot(page, `home-${locale}`);
    });

    test('projects list (or its empty state)', async ({ page }) => {
      await go(page, path(locale, '/projects'));
      await snapshot(page, `projects-${locale}`);
    });

    test('project detail (or the 404 state when nothing is published)', async ({ page }) => {
      const href = await discoverDetail(page, locale, '/projects/', '/projects');
      if (href) {
        await go(page, href);
        await snapshot(page, `project-detail-${locale}`);
      } else {
        // The designed not-found page is a state worth pinning too.
        await go(page, path(locale, '/projects/no-such-project-e2e'));
        await snapshot(page, `not-found-${locale}`);
      }
    });

    test('contact (two forms)', async ({ page }) => {
      await go(page, path(locale, '/contact'));
      await snapshot(page, `contact-${locale}`);
    });

    test('verify', async ({ page }) => {
      await go(page, path(locale, '/verify'));
      await snapshot(page, `verify-${locale}`);
    });
  });
}

test.describe('visual (admin)', () => {
  test('admin login', async ({ page }) => {
    await go(page, '/admin/login');
    await snapshot(page, 'admin-login');
  });
});
