import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { DETAIL_ROUTES, STATIC_ROUTES, discoverDetail, expect, path, test, go } from './fixtures';

/**
 * axe-core on every public route in the project's locale, plus the admin
 * login. WCAG 2.2 AA is the bar (`docs/spec/06-BUILD-PLAN.md §11`, "zero new
 * axe violations").
 *
 * `incomplete` results — checks axe could not decide, mostly colour contrast on
 * gradients and images — are attached to the report rather than failed on, so
 * they are visible without being noise.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;

function summarise(items: AxeResults['violations']): string {
  return items
    .map(
      (v) =>
        `${v.id} [${v.impact ?? 'n/a'}] ${v.help}\n` +
        v.nodes
          .slice(0, 5)
          .map((n) => `    ${n.target.join(' ')}\n      ${n.failureSummary?.split('\n').join('\n      ')}`)
          .join('\n') +
        (v.nodes.length > 5 ? `\n    … and ${v.nodes.length - 5} more` : ''),
    )
    .join('\n');
}

async function audit(page: Page, info: TestInfo) {
  const results = await new AxeBuilder({ page })
    .withTags(TAGS)
    // Turnstile's iframe is Cloudflare's document, not ours.
    .exclude('.cf-turnstile')
    .analyze();

  if (results.incomplete.length > 0) {
    await info.attach('axe-incomplete', {
      contentType: 'text/plain',
      body: summarise(results.incomplete),
    });
  }

  // `best-practice` rules are reported but not failed on: WCAG is the gate.
  const gating = results.violations.filter((v) => v.tags.some((t) => t.startsWith('wcag')));
  const advisory = results.violations.filter((v) => !v.tags.some((t) => t.startsWith('wcag')));
  if (advisory.length > 0) {
    await info.attach('axe-best-practice', { contentType: 'text/plain', body: summarise(advisory) });
  }

  expect(gating, `WCAG violations on ${page.url()}:\n${summarise(gating)}`).toEqual([]);
}

test.describe('axe — public routes', () => {
  for (const { route, implemented, contentGated } of STATIC_ROUTES) {
    test(`${route}`, async ({ page, siteLocale }, info) => {
      const response = await go(page, path(siteLocale, route));
      const status = response?.status() ?? 0;
      test.fixme(!implemented && status === 404, `route ${route} is not implemented yet`);
      test.skip(Boolean(contentGated) && status === 404, `no published CMS page behind ${route}`);
      expect(status).toBe(200);
      await audit(page, info);
    });
  }

  for (const { list, prefix } of DETAIL_ROUTES) {
    test(`first published ${prefix}[slug]`, async ({ page, siteLocale }, info) => {
      const href = await discoverDetail(page, siteLocale, prefix, list);
      test.skip(!href, `no published item under ${list}`);
      await go(page, href as string);
      await audit(page, info);
    });
  }

  test('/projects with active filters (facet panel state)', async ({ page, siteLocale }, info) => {
    await go(page, path(siteLocale, '/projects?gov=rafah&theme=women'));
    await audit(page, info);
  });

  test('the 404 page', async ({ page, siteLocale }, info) => {
    await go(page, path(siteLocale, '/no-such-page-e2e'));
    await audit(page, info);
  });
});

test.describe('axe — admin', () => {
  test('/admin/login', async ({ page }, info) => {
    const response = await go(page, '/admin/login');
    expect(response?.status()).toBe(200);
    await audit(page, info);
  });
});
