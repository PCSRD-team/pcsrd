import { DIR, LOCALES, STATIC_ROUTES, dict, expect, other, path, test, go } from './fixtures';

/**
 * The persistent chrome: locale negotiation, `<html>` attributes, skip link,
 * language switcher, keyboard access to the header, and the 375px overflow
 * check that is the cheapest possible RTL/LTR layout regression net.
 */

test.describe('locale negotiation (proxy)', () => {
  test('/ with no hint redirects to /ar with a 307', async ({ request }) => {
    const response = await request.get('/', {
      maxRedirects: 0,
      headers: { 'Accept-Language': '' },
    });
    expect(response.status()).toBe(307);
    expect(new URL(response.headers().location ?? '', 'http://localhost').pathname).toBe('/ar');
  });

  test('/ honours Accept-Language: en', async ({ request }) => {
    const response = await request.get('/', {
      maxRedirects: 0,
      headers: { 'Accept-Language': 'en-GB,en;q=0.9' },
    });
    expect(response.status()).toBe(307);
    expect(new URL(response.headers().location ?? '', 'http://localhost').pathname).toBe('/en');
  });

  test('a locale-less deep path keeps its path after the redirect', async ({ request }) => {
    const response = await request.get('/projects?gov=rafah', {
      maxRedirects: 0,
      headers: { 'Accept-Language': 'ar' },
    });
    expect(response.status()).toBe(307);
    const location = new URL(response.headers().location ?? '', 'http://localhost');
    expect(location.pathname).toBe('/ar/projects');
    expect(location.searchParams.get('gov')).toBe('rafah');
  });
});

test.describe('html attributes', () => {
  test('<html> carries the right lang and dir', async ({ page, siteLocale }) => {
    await go(page, path(siteLocale, '/'));
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', siteLocale);
    await expect(html).toHaveAttribute('dir', DIR[siteLocale]);
    // `dir` must be *computed*, not merely present: the scrollbar side and
    // `text-align: start` depend on the computed value.
    expect(await html.evaluate((el) => getComputedStyle(el).direction)).toBe(DIR[siteLocale]);
  });
});

test.describe('skip link', () => {
  test('is the first tab stop, becomes visible on focus, and targets <main>', async ({
    page,
    siteLocale,
  }) => {
    await go(page, path(siteLocale, '/'));
    const skip = page.getByRole('link', { name: dict(siteLocale).common.skipToContent });
    await expect(skip).toHaveAttribute('href', '#main');

    // Off-screen until focused — but present in the accessibility tree.
    await expect(skip).not.toBeInViewport();

    await page.keyboard.press('Tab');
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
    await expect(page.locator('main#main')).toBeAttached();
  });
});

test.describe('language switcher', () => {
  test('points at the other locale and preserves path and query', async ({ page, siteLocale }) => {
    const target = other(siteLocale);
    await go(page, path(siteLocale, '/projects?gov=rafah&year=2025'));

    const switcher = page.locator(`header a[hreflang="${target}"]`);
    await expect(switcher).toHaveCount(1);
    const href = await switcher.getAttribute('href');
    const url = new URL(href ?? '', 'http://localhost');
    expect(url.pathname).toBe(path(target, '/projects'));
    expect(url.searchParams.get('gov')).toBe('rafah');
    expect(url.searchParams.get('year')).toBe('2025');

    await switcher.click();
    await expect(page).toHaveURL(new RegExp(`${path(target, '/projects')}\\?`));
    await expect(page.locator('html')).toHaveAttribute('dir', DIR[target]);
  });

  test('on the home page it links to the bare locale root', async ({ page, siteLocale }) => {
    const target = other(siteLocale);
    await go(page, path(siteLocale, '/'));
    await expect(page.locator(`header a[hreflang="${target}"]`)).toHaveAttribute('href', `/${target}`);
  });
});

test.describe('header keyboard navigation', () => {
  test('every header control is reachable by Tab and shows a focus ring', async ({
    page,
    siteLocale,
  }) => {
    await go(page, path(siteLocale, '/'));
    const d = dict(siteLocale);

    const nav = page.locator('header').getByRole('navigation', { name: d.a11y.mainNav });
    await expect(nav).toBeVisible();

    // Tab through the header; collect what receives focus.
    const focused: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const inHeader = !!el.closest('header');
        const style = getComputedStyle(el);
        const ring =
          style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0
            ? 'outline'
            : style.boxShadow !== 'none'
              ? 'shadow'
              : 'none';
        return { inHeader, tag: el.tagName, text: (el.textContent ?? '').trim().slice(0, 40), ring };
      });
      if (!info) break;
      if (!info.inHeader) {
        if (focused.length > 0) break; // left the header
        continue; // skip link / channels bar come first
      }
      focused.push(`${info.tag}:${info.text}:${info.ring}`);
      expect(info.ring, `focused header control must show a visible focus indicator: ${info.tag} ${info.text}`).not.toBe('none');
    }

    // Home, About, Contact, Verify, the partner CTA and at least one group.
    expect(focused.length).toBeGreaterThanOrEqual(5);
    expect(focused.join('\n')).toContain(d.nav.about);
    expect(focused.join('\n')).toContain(d.nav.verify);
  });

  test('a navigation group opens with Enter and closes with Escape', async ({ page, siteLocale }) => {
    await go(page, path(siteLocale, '/'));
    const trigger = page.locator('header nav button[aria-expanded]').first();
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const menuId = await trigger.getAttribute('aria-controls');
    expect(menuId).toBeTruthy();
    const menu = page.locator(`[id="${menuId}"]`);
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem').first()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('no horizontal overflow at 375px @mobile', () => {
  for (const locale of LOCALES) {
    for (const { route, implemented } of STATIC_ROUTES) {
      test(`${locale} ${route}`, async ({ page }) => {
        const response = await go(page, path(locale, route));
        test.fixme(!implemented && response?.status() === 404, `route ${route} is not implemented yet`);
        test.skip(response?.status() === 404, `no published content at ${route}`);

        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(scrollWidth, `${route} overflows horizontally (${scrollWidth}px > ${innerWidth}px)`).toBeLessThanOrEqual(innerWidth);

        // The mobile menu must open and also fit.
        const menuButton = page.locator('header button[aria-expanded]').first();
        if (await menuButton.isVisible()) {
          await menuButton.click();
          const drawer = page.getByRole('dialog').first();
          await expect(drawer).toBeVisible();
          const after = await page.evaluate(() => document.documentElement.scrollWidth);
          expect(after).toBeLessThanOrEqual(innerWidth);
        }
      });
    }
  }
});
