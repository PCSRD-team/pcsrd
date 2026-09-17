import { test as base, expect, type Locator, type Page, type Response } from '@playwright/test';
import { ar } from '@/lib/i18n/dictionaries/ar';
import { en } from '@/lib/i18n/dictionaries/en';
import type { Locale } from '@/lib/i18n/config';

/**
 * Shared fixtures and helpers for the real-browser suite.
 *
 * `siteLocale` is a **project option**, set in `playwright.config.ts`, so the
 * same spec runs once per locale project without a loop in every file. Specs
 * that need both locales in a single project (forms, security, visual) import
 * `LOCALES` and loop explicitly.
 *
 * Copy is read from the dictionaries rather than retyped here: rule 5 says the
 * dictionaries are the only source of copy, and a test that hard-codes "Nothing
 * here yet" would pass against a page that no longer says it.
 */

export type E2EOptions = { siteLocale: Locale };

export const test = base.extend<E2EOptions>({
  siteLocale: ['ar', { option: true }],
});

export { expect };

export const LOCALES = ['ar', 'en'] as const satisfies readonly Locale[];
export const DIR: Record<Locale, 'rtl' | 'ltr'> = { ar: 'rtl', en: 'ltr' };
export const DICT = { ar, en } as const;

export function dict(locale: Locale) {
  return DICT[locale];
}

export function other(locale: Locale): Locale {
  return locale === 'ar' ? 'en' : 'ar';
}

/** `/ar/projects` from `('ar', '/projects')`. */
export function path(locale: Locale, route: string): string {
  const clean = route.startsWith('/') ? route : `/${route}`;
  return clean === '/' ? `/${locale}` : `/${locale}${clean}`;
}

// ── Route inventory ──────────────────────────────────────────────────────

/**
 * The 24 public routes from `docs/spec/03-FRONTEND.md §1`, minus the dynamic
 * `[slug]` ones — those are discovered at run time from the list pages, because
 * the live database decides which slugs exist.
 *
 * `implemented: false` marks a route the spec lists that has no page file yet
 * (none at the moment — all 24 exist).
 * A 404 there is reported as `fixme` (route missing) rather than a failure;
 * every other assertion stays strict. Flip the flag when the page lands.
 */
export type StaticRoute = { route: string; implemented: boolean; contentGated?: boolean };

export const STATIC_ROUTES: readonly StaticRoute[] = [
  { route: '/', implemented: true },
  { route: '/about', implemented: true },
  { route: '/about/vision-mission', implemented: true },
  { route: '/about/governance', implemented: true },
  { route: '/about/strategy', implemented: true },
  { route: '/about/memberships', implemented: true },
  { route: '/programs', implemented: true },
  { route: '/projects', implemented: true },
  { route: '/impact', implemented: true },
  { route: '/news', implemented: true },
  { route: '/partners', implemented: true },
  { route: '/get-involved', implemented: true },
  { route: '/get-involved/partner', implemented: true },
  { route: '/get-involved/volunteer', implemented: true },
  { route: '/get-involved/support', implemented: true },
  { route: '/careers', implemented: true },
  { route: '/verify', implemented: true },
  { route: '/contact', implemented: true },
  { route: '/resources', implemented: true },
  // The legal pages exist as a route but render 404 until the CMS page with
  // that key is published — a 404 there is missing content, not a missing route.
  { route: '/legal/privacy', implemented: true, contentGated: true },
  { route: '/legal/accessibility', implemented: true, contentGated: true },
  { route: '/legal/terms', implemented: true, contentGated: true },
];

/** List page → the prefix a detail link under it must start with. */
export const DETAIL_ROUTES = [
  { list: '/programs', prefix: '/programs/' },
  { list: '/projects', prefix: '/projects/' },
  { list: '/impact', prefix: '/impact/stories/' },
  { list: '/news', prefix: '/news/' },
  { list: '/careers', prefix: '/careers/' },
] as const;

/** The first published detail slug reachable from a list page, or null. */
export async function discoverDetail(
  page: Page,
  locale: Locale,
  prefix: string,
  list: string,
): Promise<string | null> {
  const response = await go(page, path(locale, list));
  if (!response || response.status() !== 200) return null;
  const href = await page
    .locator(`main a[href^="${path(locale, prefix)}"]`)
    .first()
    .getAttribute('href', { timeout: 5_000 })
    .catch(() => null);
  return href;
}

// ── Designed states ──────────────────────────────────────────────────────

/**
 * The empty-state panel from `src/components/ui/states.tsx`.
 *
 * Matched by its copy — every caller passes `dict.states.emptyTitle` or a
 * section-specific title such as `careers.noOpenings`, and the body is always
 * `states.emptyBody` or `states.emptyFiltered`. Matching on the body catches
 * every variant with one locator.
 */
export function emptyState(page: Page, locale: Locale): Locator {
  const d = dict(locale);
  return page
    .locator('main')
    .getByText(new RegExp(`^(${escape(d.states.emptyBody)}|${escape(d.states.emptyFiltered)})$`));
}

export function untranslatedNotice(page: Page, locale: Locale): Locator {
  return page.locator('main').getByText(dict(locale).states.untranslatedTitle, { exact: true });
}

/**
 * Passes when the list has at least one item **or** the designed empty state is
 * on the page. The live database is mostly draft content, so an empty list is
 * a valid outcome — what is not valid is an empty list with nothing designed
 * in its place, which is non-negotiable #10.
 *
 * Returns how many items were found so a journey can decide whether to go on.
 */
export async function expectListOrEmpty(page: Page, locale: Locale, items: Locator): Promise<number> {
  const count = await items.count();
  if (count > 0) return count;
  await expect(emptyState(page, locale), 'empty list must render the designed EmptyState').toBeVisible();
  return 0;
}

// ── Small utilities ──────────────────────────────────────────────────────

export function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The 404 page is bilingual and carries both headings; the Arabic one is the
 * `<h1>`. Asserting on it proves the *designed* not-found page rendered, not
 * Next's default.
 */
export async function expectDesignedNotFound(page: Page) {
  await expect(page.locator('h1')).toHaveText(ar.states.notFoundTitle);
  await expect(page.locator('h2').filter({ hasText: en.states.notFoundTitle })).toBeVisible();
}

/** Every forwarded address is unique, so the live rate limiter never sees a
 *  test as the same client twice. `10.x` is never routable. */
export function fakeIp(seed: number): string {
  const n = (seed * 2654435761 + Date.now()) >>> 0;
  return `10.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
}

// ── Navigation ───────────────────────────────────────────────────────────

/**
 * `page.goto` that resolves on `domcontentloaded` and then waits for `load`
 * only as long as it is cheap.
 *
 * A Turbopack dev server on a slow disk can take a minute to stream every
 * chunk, font and optimised image, and the `load` event does not fire until
 * the last of them arrives. Nothing in these tests depends on that event: the
 * server-rendered DOM is what is under test, and a Server Component page is
 * complete at DCL. Against `next start` the second wait is a no-op.
 */
export async function go(page: Page, url: string): Promise<Response | null> {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load', { timeout: 20_000 }).catch(() => undefined);
  return response;
}
