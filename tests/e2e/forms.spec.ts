import type { Locator, Page } from '@playwright/test';
import { LOCALES, dict, expect, fakeIp, path, test, go } from './fixtures';
import type { Locale } from '@/lib/i18n/config';

/**
 * The six public forms, with and without JavaScript.
 *
 * ── NEVER SUBMIT A VALID FORM ──────────────────────────────────────────────
 * The dev server points at the **live** database and the **live** email
 * service. A valid submission writes a row to `submissions`, fires a Resend
 * email to a real inbox and, for a complaint, opens a case a human has to
 * close. Every submission here is empty or invalid on purpose, and the
 * assertions are about the *validation* response only.
 *
 * The rate limiter runs before validation (`src/actions/public/forms.ts`) and
 * allows 5 submissions per hour per client, keyed on `x-forwarded-for`. Each
 * describe block forwards a unique unroutable address so a test run — or two
 * in a row — never trips it.
 *
 * What is asserted for each form:
 *   - the form is there, with a submit button and the Turnstile mount;
 *   - the honeypot is out of the viewport, out of the tab order and out of
 *     the accessibility tree;
 *   - an empty submit returns a **server-rendered** validation response: the
 *     form-level alert, `aria-invalid` on the failing controls, and an
 *     `aria-describedby` that points at a rendered `#<name>-error` element;
 *   - focus is not lost after a failed submit (JS project only — a full page
 *     reload without JS resets focus to the document by definition).
 */

type FormSpec = {
  name: string;
  route: string;
  /** A selector that is unique to this form — several pages host two. */
  selector: string;
  /** Required fields whose empty value must produce a field error. */
  required: string[];
};

const FORMS: FormSpec[] = [
  {
    name: 'contact',
    route: '/contact',
    selector: 'form:has(select[name="enquiryType"])',
    required: ['name', 'email', 'subject', 'message'],
  },
  {
    name: 'complaint',
    route: '/contact',
    selector: 'form:has(select[name="category"])',
    required: ['category', 'description'],
  },
  {
    name: 'partner',
    route: '/get-involved/partner',
    selector: 'form:has(input[name="organizationName"])',
    required: ['organizationName', 'organizationType', 'contactName', 'email', 'message'],
  },
  {
    name: 'volunteer',
    route: '/get-involved/volunteer',
    selector: 'form:has(select[name="ageBand"])',
    required: ['name', 'email', 'phone', 'ageBand', 'governorate', 'motivation'],
  },
  {
    name: 'fraud-report',
    route: '/verify',
    selector: 'form:has(select[name="channel"])',
    required: ['channel', 'identifier', 'description'],
  },
];

async function expectHoneypotHidden(form: Locator) {
  const honeypot = form.locator('input[name="website"]');
  await expect(honeypot).toHaveCount(1);
  await expect(honeypot).toHaveAttribute('tabindex', '-1');
  await expect(honeypot).toHaveAttribute('autocomplete', 'off');
  await expect(honeypot).not.toBeInViewport();
  // Out of the accessibility tree: no textbox named "Website" is exposed.
  await expect(form.getByRole('textbox', { name: 'Website' })).toHaveCount(0);
  const wrapper = honeypot.locator('xpath=ancestor::*[@aria-hidden="true"][1]');
  await expect(wrapper).toHaveCount(1);
}

async function expectHoneypotNotInTabOrder(page: Page, form: Locator) {
  // Walk the form's tab order from its first control; the honeypot's name must
  // never come up.
  const first = form.locator('input:not([type="hidden"]):not([name="website"]), select, textarea').first();
  await first.focus();
  const seen: string[] = [];
  for (let i = 0; i < 40; i += 1) {
    const name = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el?.getAttribute('name') ?? el?.tagName ?? '';
    });
    seen.push(name);
    if (name === 'BUTTON' || name === 'BODY') break;
    await page.keyboard.press('Tab');
  }
  expect(seen, 'honeypot must not be reachable by Tab').not.toContain('website');
}

async function submitEmpty(form: Locator) {
  const submit = form.locator('button[type="submit"]');
  await expect(submit).toBeVisible();
  // `noValidate` is set on the form, so the browser does not intercept this
  // and the server sees a genuinely empty payload.
  await submit.click();
}

async function expectServerValidation(page: Page, form: Locator, locale: Locale, required: string[]) {
  const d = dict(locale);

  const alert = form.locator('[role="alert"]').filter({ hasText: d.errors.validation });
  await expect(alert, 'form-level validation alert').toBeVisible({ timeout: 30_000 });

  for (const name of required) {
    const control = form.locator(`[name="${name}"]`).first();
    await expect(control, `${name} is marked invalid`).toHaveAttribute('aria-invalid', 'true');

    const describedBy = (await control.getAttribute('aria-describedby')) ?? '';
    expect(describedBy.split(/\s+/), `${name} aria-describedby links its error`).toContain(`${name}-error`);

    const error = form.locator(`[id="${name}-error"]`);
    await expect(error, `${name}-error is rendered`).toBeVisible();
    await expect(error).not.toBeEmpty();
    // A key that did not resolve renders verbatim — visibly wrong on purpose.
    await expect(error).not.toHaveText(/^errors\./);
    // Rule 5: every message is a dictionary key. Zod's built-in English
    // ("Invalid option: expected one of …") reaching an Arabic page means a
    // schema is missing its `{ message }`.
    await expect
      .soft(error, `${name} error must be dictionary copy, not Zod's default`)
      .not.toHaveText(/^Invalid /);
  }

  // No receipt, no reference number: nothing was accepted.
  await expect(page.locator('[role="status"]')).toHaveCount(0);
  await expect(page.getByText(/PCS-\d{6}/)).toHaveCount(0);
}

async function expectFocusKept(page: Page, form: Locator) {
  // After a failed submit, focus must be somewhere useful: on the alert, on an
  // invalid control, or still on the submit button. Losing it to <body> makes
  // a keyboard user start over from the top of the page.
  const where = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return 'body';
    if (el.closest('[role="alert"]')) return 'alert';
    if (el.getAttribute('aria-invalid') === 'true') return 'invalid-control';
    if (el.matches('button[type="submit"]')) return 'submit';
    return `${el.tagName.toLowerCase()}[name=${el.getAttribute('name')}]`;
  });
  expect.soft(where, 'focus after a failed submit').not.toBe('body');
  await expect(form).toBeVisible();
}

for (const locale of LOCALES) {
  for (const spec of FORMS) {
    test.describe(`${spec.name} form (${locale})`, () => {
      test.use({ extraHTTPHeaders: { 'x-forwarded-for': fakeIp(locale.length * 100 + FORMS.indexOf(spec)) } });

      test('renders with honeypot hidden and rejects an empty submission', async ({ page }, info) => {
        const jsEnabled = info.project.use.javaScriptEnabled !== false;
        const response = await go(page, path(locale, spec.route));
        expect(response?.status()).toBe(200);

        const form = page.locator(spec.selector);
        await expect(form).toHaveCount(1);
        await expect(form.locator('input[name="locale"]')).toHaveAttribute('value', locale);
        await expect(form.locator('.cf-turnstile'), 'Turnstile mount point').toHaveCount(1);
        await expectHoneypotHidden(form);
        if (jsEnabled) await expectHoneypotNotInTabOrder(page, form);

        await submitEmpty(form);
        const afterSubmit = page.locator(spec.selector);
        await expectServerValidation(page, afterSubmit, locale, spec.required);
        if (jsEnabled) await expectFocusKept(page, afterSubmit);
      });
    });
  }

  test.describe(`job application form (${locale})`, () => {
    test.use({ extraHTTPHeaders: { 'x-forwarded-for': fakeIp(locale.length * 100 + 9) } });

    test('on the first open vacancy: file input accepts PDF and an empty submit is rejected', async ({
      page,
    }, info) => {
      const jsEnabled = info.project.use.javaScriptEnabled !== false;
      await go(page, path(locale, '/careers'));
      const first = page.locator(`main a[href^="${path(locale, '/careers/')}"]`).first();
      test.skip((await first.count()) === 0, 'no open vacancy in the live database');

      await first.click();
      await expect(page).toHaveURL(new RegExp(`${path(locale, '/careers/')}`));

      const form = page.locator('form:has(input[name="cv"])');
      await expect(form).toHaveCount(1);
      await expect(form).toHaveAttribute('enctype', 'multipart/form-data');
      await expect(form.locator('input[name="vacancyId"]')).toHaveAttribute('value', /\S/);

      const cv = form.locator('input[name="cv"]');
      await expect(cv).toHaveAttribute('type', 'file');
      expect((await cv.getAttribute('accept')) ?? '').toContain('application/pdf');
      const hint = (await cv.getAttribute('aria-describedby')) ?? '';
      expect(hint.split(/\s+/)).toContain('cv-hint');

      await expectHoneypotHidden(form);
      if (jsEnabled) await expectHoneypotNotInTabOrder(page, form);

      await submitEmpty(form);
      const afterSubmit = page.locator('form:has(input[name="cv"])');
      await expectServerValidation(page, afterSubmit, locale, ['name', 'email', 'phone']);
      if (jsEnabled) await expectFocusKept(page, afterSubmit);
    });
  });
}
