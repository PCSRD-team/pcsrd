import { dict, emptyState, expect, expectListOrEmpty, path, test, go } from './fixtures';

/**
 * The six journeys from `docs/spec/06-BUILD-PLAN.md §10`, in the project's
 * locale. Where the live database has nothing published for a step, the
 * journey asserts the designed empty state and stops there — that is a valid
 * outcome for a site whose content is mostly still draft, and the state
 * itself is what non-negotiable #10 requires.
 *
 * No journey submits a form. The forms are covered by `forms.spec.ts` with
 * invalid data only; see the warning at the top of that file.
 */

const WA_HREF = /^https:\/\/wa\.me\/\d{8,15}(\?text=.+)?$/;

test('J1 — donor diligence: home → about → verify → resources', async ({ page, siteLocale }) => {
  const d = dict(siteLocale);
  await go(page, path(siteLocale, '/'));
  await expect(page.locator('h1')).toHaveCount(1);

  // The header carries the whole diligence path.
  const header = page.locator('header');
  await header.getByRole('link', { name: d.nav.about, exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`${path(siteLocale, '/about')}$`));
  await expect(page.locator('h1')).toHaveText(/\S/);

  await header.getByRole('link', { name: d.nav.verify, exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`${path(siteLocale, '/verify')}$`));
  await expect(page.locator('h1')).toHaveText(d.verify.title);

  // Resources is a footer / secondary link; navigating directly is fine as
  // long as the page renders a list or its empty state.
  await go(page, path(siteLocale, '/resources'));
  await expect(page.locator('h1')).toHaveText(/\S/);
  await expectListOrEmpty(page, siteLocale, page.locator('main a[href$=".pdf"], main article, main li a[download]'));
});

test('J2 — beneficiary → WhatsApp CTA has a well-formed wa.me href', async ({ page, siteLocale }) => {
  // `/get-involved/support` is the spec's home for this CTA; until that route
  // exists the same link lives in the chrome on every page.
  const support = await go(page, path(siteLocale, '/get-involved/support'));
  if (support?.status() !== 200) await go(page, path(siteLocale, '/'));

  const links = page.locator('a[href^="https://wa.me/"]');
  const count = await links.count();
  test.skip(count === 0, 'organization_settings has no WhatsApp number published');

  for (let i = 0; i < count; i += 1) {
    const link = links.nth(i);
    const href = (await link.getAttribute('href')) ?? '';
    expect(href).toMatch(WA_HREF);
    expect(href, 'a wa.me number never starts with 0 or +').toMatch(/^https:\/\/wa\.me\/[1-9]/);
    expect((await link.getAttribute('rel')) ?? '', 'external link opens safely').toContain('noopener');
    // Do not click: it would leave the site.
  }
});

test('J3 — partner filters the project list; the URL carries the facets', async ({ page, siteLocale }) => {
  const d = dict(siteLocale);
  await go(page, path(siteLocale, '/projects'));
  await expect(page.locator('h1')).toHaveText(d.projects.title);

  const panel = page.getByRole('form', { name: d.a11y.filterPanel });
  await expect(panel).toBeVisible();

  const cards = page.locator('main ul li a[href*="/projects/"]');
  const before = await expectListOrEmpty(page, siteLocale, cards);

  const facet = panel.locator('input[type="checkbox"]').first();
  if ((await facet.count()) > 0) {
    // A facet exists: use the form the way a person would — no JS needed.
    const name = await facet.getAttribute('name');
    const value = await facet.getAttribute('value');
    await facet.check();
    await panel.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(new RegExp(`/projects\\?.*${name}=${value}`));
    await expect(panel.locator(`input[name="${name}"][value="${value}"]`)).toBeChecked();
    await expectListOrEmpty(page, siteLocale, cards);

    await panel.getByRole('link', { name: d.projects.clearFilters }).click();
    await expect(page).toHaveURL(new RegExp(`${path(siteLocale, '/projects')}$`));
    expect(await cards.count()).toBe(before);
  } else {
    // No published project → no facets to click. The URL contract still holds.
    await go(page, path(siteLocale, '/projects?gov=rafah&theme=women&year=2025'));
    await expect(emptyState(page, siteLocale)).toHaveText(d.states.emptyFiltered);
  }

  // Unknown facet values are dropped, not echoed and not an error.
  const response = await go(page, path(siteLocale, '/projects?gov=<script>&program=x'));
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText(d.projects.title);
});

test('J4 — volunteer page carries the application form', async ({ page, siteLocale }) => {
  const d = dict(siteLocale);
  await go(page, path(siteLocale, '/get-involved/volunteer'));
  await expect(page.locator('h1')).toHaveText(/\S/);

  const form = page.locator('form:has(select[name="ageBand"])');
  await expect(form).toHaveCount(1);
  for (const name of ['name', 'email', 'phone', 'ageBand', 'governorate', 'motivation']) {
    await expect(form.locator(`[name="${name}"]`)).toBeVisible();
    // Every control is labelled through <label for>.
    await expect(form.locator(`label[for="${name}"]`)).toHaveCount(1);
  }
  await expect(form.locator('fieldset:has(input[name="areas"])')).toBeVisible();
  await expect(form.locator('button[type="submit"]')).toHaveText(d.common.submit);
  // Age band, not date of birth; governorate, not address. No national ID.
  await expect(form.locator('[name="dateOfBirth"], [name="nationalId"], [name="address"]')).toHaveCount(0);
});

test('J5 — job page → application form with a PDF-accepting file input', async ({ page, siteLocale }) => {
  const d = dict(siteLocale);
  await go(page, path(siteLocale, '/careers'));
  await expect(page.locator('h1')).toHaveText(d.careers.title);

  const vacancies = page.locator(`main a[href^="${path(siteLocale, '/careers/')}"]`);
  const count = await vacancies.count();
  if (count === 0) {
    await expect(page.locator('main').getByText(d.careers.noOpenings, { exact: true })).toBeVisible();
    test.skip(true, 'no open vacancy in the live database — empty state verified');
  }

  await vacancies.first().click();
  await expect(page).toHaveURL(new RegExp(`${path(siteLocale, '/careers/')}`));
  await expect(page.locator('h1')).toHaveText(/\S/);

  const form = page.locator('form:has(input[name="cv"])');
  await expect(form).toHaveCount(1);
  await expect(form).toHaveAttribute('enctype', 'multipart/form-data');
  const cv = form.locator('input[type="file"][name="cv"]');
  await expect(cv).toBeVisible();
  expect((await cv.getAttribute('accept')) ?? '').toMatch(/\.pdf|application\/pdf/);
  await expect(form.locator('label[for="cv"]')).toHaveCount(1);
  await expect(form.locator('#cv-hint')).toBeVisible();
});

test('J6 — verify page: official channels table or its empty state', async ({ page, siteLocale }) => {
  const d = dict(siteLocale);
  await go(page, path(siteLocale, '/verify'));
  await expect(page.locator('h1')).toHaveText(d.verify.title);

  const table = page.locator('main table');
  if ((await table.count()) > 0) {
    await expect(table.locator('thead th')).not.toHaveCount(0);
    const rows = table.locator('tbody tr');
    expect(await rows.count()).toBeGreaterThan(0);
    // Every channel row links out, and does so safely.
    const links = rows.locator('a[href^="http"]');
    const n = await links.count();
    for (let i = 0; i < n; i += 1) {
      const rel = (await links.nth(i).getAttribute('rel')) ?? '';
      expect(rel).toContain('noopener');
      // A Latin handle inside an Arabic table is isolated (`<bdi>` / dir=ltr).
      const isolated = await links
        .nth(i)
        .evaluate((el) => !!el.closest('bdi, [dir="ltr"]') || !!el.querySelector('bdi, [dir="ltr"]'));
      expect.soft(isolated, `channel link ${i} isolates Latin text`).toBe(true);
    }
  } else {
    await expect(emptyState(page, siteLocale)).toBeVisible();
  }

  // The fraud-report form is on the same page (covered in forms.spec.ts).
  await expect(page.locator('form:has(select[name="channel"])')).toHaveCount(1);
});
