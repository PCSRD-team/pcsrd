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

  // Every page carries a share card and the feed link. A page-level
  // `openGraph` replaces the layout's, so both are set by `buildMetadata`,
  // and a regression there drops them from every static page at once.
  await expect(page.locator('meta[property="og:image"]'), 'og:image').not.toHaveCount(0);
  await expect(
    page.locator('link[rel="alternate"][type="application/rss+xml"]'),
    'RSS autodiscovery link',
  ).toHaveCount(1);

  // The language link is in the served HTML, not only after hydration: the
  // Suspense fallback is a real link built from the path.
  await expect(page.locator(`a[hreflang="${locale === 'ar' ? 'en' : 'ar'}"]`).first()).toHaveAttribute(
    'href',
    /^\/(ar|en)/,
  );

  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical, 'canonical link').toHaveCount(1);
  const canonicalHref = await canonical.getAttribute('href');
  expect(canonicalHref, 'canonical must be absolute').toMatch(/^https?:\/\//);
  // `URL.pathname` is percent-encoded; the route is text. An Arabic slug
  // compared raw against encoded never matches, however correct the tag is.
  const canonicalPath = decodeURIComponent(new URL(canonicalHref ?? '').pathname);

  // A noindexed page — an unwritten policy, a record marked `noIndex` —
  // canonicalises to itself and advertises no alternates (`buildMetadata`).
  const noIndexed = (await page.locator('meta[name="robots"][content*="noindex"]').count()) > 0;
  if (noIndexed) {
    // …unless it is the English page of an `ar_only` record, which is
    // noindexed *and* canonicalises to its Arabic original.
    if (locale === 'en' && canonicalPath.startsWith('/ar/')) return;
    expect(canonicalPath, 'a noindexed page canonicalises to itself').toBe(path(locale, route));
    return;
  }

  // An `ar_only` record advertises no English alternate on either page, and
  // its English page canonicalises to the Arabic one — the documented rule in
  // `src/lib/seo/metadata.ts`. The test cannot see the record's status, but
  // it can see which of the two shapes the page chose, and check that shape.
  const untranslated = (await page.locator('link[rel="alternate"][hreflang="en"]').count()) === 0;
  if (untranslated) {
    if (locale === 'en') {
      expect(canonicalPath, 'an untranslated English page canonicalises to Arabic').toMatch(/^\/ar\//);
    } else {
      expect(canonicalPath, 'canonical must point at this locale route').toBe(path(locale, route));
    }
    return;
  }
  expect(canonicalPath, 'canonical must point at this locale route').toBe(path(locale, route));

  for (const lang of ['ar', 'en', 'x-default'] as const) {
    const alt = page.locator(`link[rel="alternate"][hreflang="${lang}"]`);
    await expect(alt, `hreflang=${lang}`).toHaveCount(1);
    const href = await alt.getAttribute('href');
    expect(href, `hreflang=${lang} href`).toMatch(/^https?:\/\//);
    const expectedLocale = lang === 'x-default' ? 'ar' : lang;
    const target = decodeURIComponent(new URL(href ?? '').pathname);
    // A detail page's slug differs per locale, so only the locale prefix of
    // the other language's alternate is comparable; its own must match.
    if (expectedLocale === locale) expect(target, `hreflang=${lang} target`).toBe(path(locale, route));
    else expect(target, `hreflang=${lang} target`).toMatch(new RegExp(`^/${expectedLocale}(/|$)`));
  }
}

test.describe('static routes', () => {
  for (const { route, contentGated } of STATIC_ROUTES) {
    test(`${route}`, async ({ page, siteLocale }) => {
      const response = await go(page, path(siteLocale, route));
      expect(response, 'navigation produced a response').not.toBeNull();
      const status = response?.status() ?? 0;

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

    // The served HTML, not the live DOM. An Arabic slug once reached the page
    // percent-encoded, matched nothing, and the response was the loading
    // skeleton — the browser then rebuilt the page from the RSC payload, so
    // every DOM assertion above passed. Only the raw body shows it.
    test(`first published ${prefix}[slug] ships its heading in the HTML`, async ({
      page,
      request,
      siteLocale,
    }) => {
      const href = await discoverDetail(page, siteLocale, prefix, list);
      test.skip(!href, `no published item under ${list} in the live database`);

      // A generous timeout: on `next dev` the first request compiles the route.
      const body = await (await request.get(href as string, { timeout: 120_000 })).text();
      expect(body, 'served HTML carries an <h1>').toMatch(/<h1[\s>]/);
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

  // Detail routes stream: their shell is sent before the lookup can fail, so
  // the status is already 200 when `notFound()` runs. Next marks that body
  // `noindex` instead, which is what keeps a dead link out of the index —
  // decided and measured in docs/PROGRESS.md §5.1.2. Asserting a 404 there
  // tested a behaviour the project chose not to have.
  const STREAMED = ['/projects/', '/news/', '/programs/', '/impact/stories/', '/careers/'];

  for (const route of unknown) {
    test(`${route} → 404 with the designed not-found page`, async ({ page, siteLocale }) => {
      const response = await go(page, path(siteLocale, route));
      if (STREAMED.some((prefix) => route.startsWith(prefix))) {
        expect([200, 404]).toContain(response?.status());
        if (response?.status() === 200) {
          await expect(
            page.locator('meta[name="robots"][content*="noindex"]').first(),
            'a streamed not-found is noindexed',
          ).toBeAttached();
        }
      } else {
        expect(response?.status()).toBe(404);
      }
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
