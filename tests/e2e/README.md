# Real-browser tests

Playwright end-to-end, axe accessibility, RTL visual regression and Lighthouse
CI — the four rows at the bottom of the table in `docs/spec/06-BUILD-PLAN.md §10`.

## Never submit a valid form

The dev server reads `.env.local`, which points at the **live** Supabase
database, the **live** Resend account and the **live** Upstash limiter. A
valid submission from a test:

- writes a row to `submissions` that an editor has to find and delete;
- sends a real email to a real inbox (`MAIL_TO_*`);
- for a complaint or fraud report, opens a confidential case that a person is
  obliged to act on.

Every submission in `forms.spec.ts` is therefore **empty**. The assertions are
about the validation response — `aria-invalid`, `aria-describedby`, the
`#<field>-error` element, the form-level alert — and never about a receipt.
`admin.spec.ts` submits an empty login and never a credential. If you add a
test that fills a form in, it must still be invalid when it reaches the server
(no Turnstile token is the last line of defence, but do not rely on it).

The rate limiter runs **before** validation and allows five submissions per
hour per client. Each describe block forwards a unique `x-forwarded-for` so
the suite never trips it; do not remove that header.

## Running locally

```sh
# 1. a server on port 3100 (the config reuses it; leave it running)
npx next dev --port 3100

# 2. the suites
npm run test:e2e            # everything, all five projects
npm run test:e2e:ui         # the same, in the Playwright UI
npm run test:a11y           # axe on every route, both locales, + /admin/login
npm run test:visual         # screenshots against the committed baselines
npx playwright test --project=no-js          # one project
npx playwright test routes.spec.ts --project=chromium-en   # one file, one locale

# 3. the report
npx playwright show-report
```

The first run is slow: the dev server compiles each route on first hit, and
a heavy route can take 30 s. Second runs are fast. If a route answers 500
while another agent or a colleague is mid-edit in `src/`, the failure is
theirs — re-run once the server log is clean rather than editing tests.

Chromium is installed once with `npx playwright install chromium` (it does
not touch `package.json`).

## Projects

| project       | runs                                        | why                                               |
|---------------|---------------------------------------------|---------------------------------------------------|
| `chromium-ar` | shell, routes, a11y, journeys — Arabic      | the default locale, RTL, the primary drawing      |
| `chromium-en` | the same — English                          | LTR mirror                                        |
| `chromium`    | forms, admin, security, visual              | these loop both locales themselves                |
| `no-js`       | forms, admin with `javaScriptEnabled:false` | non-negotiable #7                                 |
| `mobile`      | `@mobile` tests in shell.spec at 375 px     | horizontal overflow is the cheapest RTL regression |

## Empty states are a valid outcome

The live content is mostly draft. `expectListOrEmpty()` in `fixtures.ts`
passes when a list has items **or** the designed `EmptyState` from
`src/components/ui/states.tsx` is rendered. A list that is empty *without*
that panel is a failure — that is non-negotiable #10. Journeys that need a
published item (a vacancy, a project) verify the empty state and `skip` the
rest with a reason, so the report says "missing content", not "broken".

Routes the spec lists that have no page yet are marked `implemented: false`
in `fixtures.ts`; a 404 there is reported as `fixme`. Flip the flag when the
page lands and every assertion applies in full.

## Updating screenshots

Baselines live in `tests/e2e/__screenshots__/visual.spec.ts/` and are keyed
by platform (`-win32`, `-linux`, `-darwin`), because font rasterisation
differs and a Windows baseline never matches a Linux render.

```sh
npm run test:visual:update
```

Commit the new PNGs **with the change that caused them**, and look at the
diff image in the report first: a screenshot that changed for a reason other
than the one in your PR is the regression this net exists to catch. Images,
`<time>`, iframes and the Turnstile mount are masked; if you add dynamic
content, give it `data-dynamic` and it is masked too.

CI runs with `--ignore-snapshots` until Linux baselines are committed; the
"Visual regression" step generates them and the Playwright report artifact
contains them.

## Lighthouse

```sh
npm run lhci
```

`lighthouserc.cjs` probes five routes on `http://localhost:3100` and asserts
the §9 budgets. Numbers from `next dev` are indicative only — the
development bundle is several times the production one. The workflow runs it
against `next start`.

## Ownership

These files, `playwright.config.ts`, `lighthouserc.cjs` and
`.github/workflows/e2e.yml` are the test layer. A failing assertion that
points at `src/` is reported, not patched here.
