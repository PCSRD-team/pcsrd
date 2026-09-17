import { expect, test, go } from './fixtures';

/**
 * The admin boundary from the outside, unauthenticated. Runs in the JS
 * project and the `no-js` project — the login form is a Server Action form
 * and must work before hydration like every other form (non-negotiable #7).
 *
 * No real credentials are ever used. The only submission is an **empty** one,
 * which the action rejects before it reaches Supabase Auth.
 */

test.describe('unauthenticated redirects', () => {
  for (const route of ['/admin', '/admin/submissions/sensitive', '/admin/users', '/admin/organization']) {
    test(`${route} → /admin/login`, async ({ page }) => {
      await go(page, route);
      await expect(page).toHaveURL(/\/admin\/login$/);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  }

  test('the redirect happens on the server, not after a client render', async ({ request }) => {
    const response = await request.get('/admin', { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(response.status());
    expect(response.headers().location).toMatch(/\/admin\/login$/);
  });

  test('admin routes are noindex and carry the nonce CSP', async ({ request }) => {
    const response = await request.get('/admin/login');
    expect(response.status()).toBe(200);
    const csp = response.headers()['content-security-policy'] ?? '';
    expect(csp).toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/);
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

test.describe('login form', () => {
  test('renders labelled controls and a submit', async ({ page }) => {
    await go(page, '/admin/login');
    const form = page.locator('form:has(input[name="password"])');
    await expect(form).toHaveCount(1);
    await expect(form.locator('label[for="email"]')).toHaveCount(1);
    await expect(form.locator('label[for="password"]')).toHaveCount(1);
    await expect(form.locator('input[name="email"]')).toHaveAttribute('autocomplete', 'username');
    await expect(form.locator('input[name="password"]')).toHaveAttribute('autocomplete', 'current-password');
    await expect(form.locator('input[name="password"]')).toHaveAttribute('type', 'password');
    await expect(form.locator('button[type="submit"]')).toBeVisible();
  });

  test('an empty submission is rejected server-side with a validation message', async ({ page }) => {
    await go(page, '/admin/login');
    const form = page.locator('form:has(input[name="password"])');

    // The inputs carry `required`, so a plain click is stopped by the browser
    // before any request. Submitting the form element directly bypasses
    // constraint validation and proves the **server** rejects an empty body —
    // which is the check that matters when the browser's own is absent.
    // `form.submit()` posts natively whether or not page scripts run.
    await form.evaluate((el) => (el as HTMLFormElement).submit());

    await expect(page).toHaveURL(/\/admin\/login/);
    const alert = page.locator('[role="alert"]');
    await expect(alert).toBeVisible({ timeout: 30_000 });
    await expect(alert).not.toBeEmpty();
    // Still on the login page, still unauthenticated.
    await expect(page.locator('form:has(input[name="password"])')).toHaveCount(1);
  });

  test('no session cookie is set by merely visiting the page', async ({ context, page }) => {
    await go(page, '/admin/login');
    const cookies = await context.cookies();
    expect(cookies.filter((c) => /auth|session|sb-/.test(c.name))).toEqual([]);
  });
});
