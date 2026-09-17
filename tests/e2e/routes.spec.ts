import type { Page } from '@playwright/test';
import {
  DETAIL_ROUTES,
  DIR,
  STATIC_ROUTES,
  discoverDetail,
  expect,
  expectDesignedNotFound,
  go,
  path,
  test,
} from './fixtures';
import type { Locale } from '@/lib/i18n/config';

/**
 * Every public route from `docs/spec/03-FRONTEND.md §1`, in the project's
 * locale: it answers, it has one `<h1>` and a `<main>`, and it carries the
 * metadata the SEO work is responsible for. The metadata assertions are
 * generic on purpose — presence and shape, never copy — so they verify that
 * work when it lands without being coupled to it.
 */

async function expectDocumentShape(page: Page, locale: Locale, route: string) {
  const html = page.locator('html');
  await expect(html).toHaveAttribute('lang', locale);
  await expect(html).toHaveAttribute('dir', DIR[locale]);

  await expect(page.locator('main'), 'exactly one <main>').toHaveCount(1);
  await expect(page.locator('h1'), 'exactly one <h1>').toHaveCount(1);
  await expect(page.locator('h1')).not.toBeEmpty();

  await expect(page).toHaveTitle(/\S/);

  // Matched document-wide rather than under `head`: Next 16 streams
  // `generateMetadata` output for dynamic routes and React hoists it into
  // `<head>` on hydration, so before hydration the tags sit at the end of the
  // body. Crawlers that execute JS see them in `<head>`; ones that do not
  // still see the tags. Presence and target are what is asserted.
  const description = page.locator('meta[name="description"]');
  await expect(description, 'meta description').toHaveCount(1);
  expect((await description.getAttribute('content'))?.trim(), 'meta description content').toBeTruthy();

  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical, 'canonical link').toHaveCount(1);
  const canonicalHref = await canonical.getAttribute('href');
  expect(canonicalHref, 'canonical must be absolute').toMatch(/^https?:\/\//);
  expect(new URL(canonicalHref ?? '').pathname, 'canonical must point at this locale route').toBe(path(locale, route));

  for (const lang of ['ar', 'en', 'x-default'] as const) {
    const alt = page.locator(`link[rel="alternate"][hreflang="${lang}"]`);
    await expect(alt, `hreflang=${lang}`).toHaveCount(1);
    const href = await alt.getAttribute('href');
    expect(href, `hreflang=${lang} href`).toMatch(/^https?:\/\//);
    const expectedLocale = lang === 'x-default' ? 'ar' : lang;
    expect(new URL(href ?? '').pathname, `hreflang=${lang} target`).toBe(path(expectedLocale, route));
  }
}

test.describe('static routes', () => {
  for (const { route, implemented, contentGated } of STATIC_ROUTES) {
    test(`${route}`, async ({ page, siteLocale }) => {
      const response = await go(page, path(siteLocale, route));
      expect(response, 'navigation produced a response').not.toBeNull();
      const status = response?.status() ?? 0;

      test.fixme(!implemented && status === 404, `route ${route} exists in the spec but not in src/app yet`);
      test.skip(Boolean(contentGated) && status === 404, `no published CMS page behind ${route}`);

      expect(status, `${route} should answer 200`).toBe(200);
      await expectDocumentShape(page, siteLocale, route);
    });
  }
});

test.describe('detail routes', () => {
  for (const { list, prefix } of DETAIL_ROUTES) {
    test(`first published ${prefix}[slug]`, async ({ page, siteLocale }) => {
      const href = await discoverDetail(page, siteLocale, prefix, list);
      test.skip(!href, `no published item under ${list} in the live database`);

      const response = await go(page, href as string);
      expect(response?.status()).toBe(200);
      const route = (href as string).replace(new RegExp(`^/${siteLocale}`), '');
      await expectDocumentShape(page, siteLocale, route);
    });
  }
});

test.describe('unknown slugs', () => {
  const unknown = [
    '/this-route-does-not-exist',
    '/projects/no-such-project-e2e',
    '/news/no-such-post-e2e',
    '/programs/no-such-program-e2e',
    '/impact/stories/no-such-story-e2e',
    '/careers/no-such-vacancy-e2e',
    '/legal/no-such-page-e2e',
  ];

  for (const route of unknown) {
    test(`${route} → 404 with the designed not-found page`, async ({ page, siteLocale }) => {
      const response = await go(page, path(siteLocale, route));
      expect(response?.status()).toBe(404);
      await expect(page.locator('main')).toHaveCount(1);
      await expectDesignedNotFound(page);
      // The chrome survives the 404 — a lost reader still has the header.
      await expect(page.locator('header')).toBeVisible();
    });
  }

  test('an unknown locale prefix is a 404 too', async ({ page }) => {
    const response = await go(page, '/fr/about');
    // The proxy treats `fr` as a locale-less path and redirects to /ar/fr/about,
    // which the segment guard then rejects.
    expect(response?.status()).toBe(404);
    await expectDesignedNotFound(page);
  });
});
