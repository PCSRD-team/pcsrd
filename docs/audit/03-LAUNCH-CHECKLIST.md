# 03 — Launch checklist

Three states, and only three:

- **DONE** — fixed and verified in this audit. The verification is named.
- **TODO** — a code change that is understood and unblocked. Anyone can do it.
- **MY-ACTION-REQUIRED** — needs you: a credential, a decision, an access grant, or
  organisational copy I must not invent.

Ordered so that the things that stop a launch come first.

---

## 1. Blockers — the site does not work correctly until these are done

- [x] **DONE** — Bind `app.actor_id` on the identity read so anyone can sign in to the CMS.
      *Verified:* real Postgres as `app_runtime` returns the caller's own row and zero others.
- [x] **DONE** — Bind it in `signIn` too. The first fix missed a **second** unbound read of
      `profiles`, so every correct password was still rejected with "your account has been
      deactivated". *Verified:* before `rows=0` → rejects, after `rows=1` → allows.
- [x] **DONE** — Bind `app.can_view_sensitive` in `withActor` so the confidential complaints
      inbox is not permanently empty. *Verified:* same harness, before 0 rows / after 1 row.
- [x] **DONE** — Bind an actor on every statement the submission service and the attachment
      route issue. *Verified:* typecheck + 27/27 integration tests.
- [x] **DONE** — Write migration `0003` granting `USAGE` on `audit_logs_id_seq`.
      *Verified:* before `permission denied for sequence`, after `INSERT OK id=1`.
- [ ] **MY-ACTION-REQUIRED** — **Apply `0003` to production.** `npm run db:migrate`, or run
      the single `grant` in the SQL editor. Until this runs, every audited mutation aborts:
      publishing a post, saving a project, uploading media. See `04-OPEN-QUESTIONS.md` A2.
- [x] **DONE** — Repair `drizzle/meta/_journal.json` so a fresh database can be built.
      *Verified:* all four entries resolve to files; `drizzle-kit check` clean.
- [x] **DONE** — Make the archive cron call `app.archive_expired_content()` instead of an
      actor-less `UPDATE` that silently matched nothing.
- [x] **DONE** — Fix the CI build so the service-role-leak assertion actually runs.
      *Verified:* build succeeds on placeholder env only; previously threw a `TypeError` at
      module scope in `src/app/robots.ts`.
- [x] **DONE** — Write `scripts/assert-rls.ts`, which CI has invoked since the pipeline was
      written and which did not exist. *Verified:* all five queries executed against a real
      Postgres with this repo's migrations — 21 tables, 85 policies, 0 unforced.
- [ ] **MY-ACTION-REQUIRED** — Confirm `DATABASE_URL` connects as `app_runtime` and **not**
      as `postgres`. `postgres` has `BYPASSRLS`, so the wrong value disables all 85 policies
      while the site keeps working. I never read a secret value, so I cannot check this.
      `scripts/assert-rls.ts` now checks the role's attributes once you can run it.

---

## 2. Accessibility — WCAG 2.2 AA

- [x] **DONE** — `<html lang dir>` on every public page. Was absent: **SC 3.1.1, Level A**.
      *Verified:* `curl` → `<html lang="ar" dir="rtl">` and `<html lang="en" dir="ltr">`.
- [x] **DONE** — One `<html>` and one `<body>` on admin. Was nested, which silently dropped
      the CMS's `dir="rtl"`. *Verified:* `curl` → exactly 1 of each.
- [x] **DONE** — Eleven invented Tailwind class names renamed to the real ones (18 sites).
      *Verified:* compiled every candidate against the project's design system.
- [x] **DONE** — `better-tailwindcss/no-unknown-classes` enabled, so it cannot recur.
- [x] **DONE** — The skip link becomes visible on focus. Was revealed by a class that does
      not exist, so it stayed 9999px off-screen: **SC 2.4.7** on the first tab stop of every page.
- [x] **DONE** — `focus:outline-none` removed from every text control (5 files).
- [x] **DONE** — Focus ring meets **SC 1.4.11**: 1.88:1 → 12.30:1 on the page ground.
- [x] **DONE** — `gold-700` 3.42:1 → 5.75:1; `mono-muted` 2.94:1 → 4.61:1; new
      `rule-control` token 1.43:1 → 3.11:1 on form-control boundaries.
- [x] **DONE** — Errors associated on `<textarea>`, `<select>`, `CheckboxGroup` and every
      admin field. The admin `Field` now owns an error slot; `ContentForm` rendered none at
      all for textareas and selects.
- [x] **DONE** — `dir="ltr"` on `column.numeric` cells in the admin `DataTable`. One
      attribute; it fixed the reference, slug and purge-date columns at once. Staff were
      reading complainants' callback numbers with the digits in the wrong order.
- [x] **DONE** — `dir="ltr"` on numeric table cells covers the reference, slug and
      purge-date columns. *(Payload values on the detail page remain — see remaining.)*
- [x] **DONE** — `/verify`'s table scrolls inside its own container. *Verified:* the wrapper
      is present in the served HTML.
- [x] **DONE** — The admin shell is a column below `md:` with a `<details>` nav, no
      JavaScript. It had zero content width at 320px.
- [x] **DONE** — The editor has `aria-labelledby` via `useId`, `role="textbox"`,
      `aria-multiline`, and the toolbar has `role="toolbar"` with a label.
- [x] **DONE** — Both are `min-h-11` (the design system's 44px). They were ≈23.2px.
- [ ] **MY-ACTION-REQUIRED** — Run axe and a keyboard pass in a real browser, both locales.
      I had no browser; every rendered-pixel claim is marked `[ASSUMPTION]` or derived from
      compiled CSS. See `04-OPEN-QUESTIONS.md` C2.

---

## 3. Safeguarding and privacy

- [x] **DONE** — The media upload route validates with `mediaMetadataSchema` instead of `as`
      casts. `consent=obtained&hasIdentifiableMinors=true` previously stored a photograph of
      an identifiable child as consented.
- [x] **DONE** — Claiming `obtained` consent for an identifiable minor now requires a consent
      reference. The rule is *documented* consent; nothing was checking for the document.
- [x] **DONE** — 12 of 32 thrown `errors.*` keys were defined in neither dictionary and
      rendered as raw Latin identifiers in the Arabic admin. All now defined in both locales.
- [ ] **MY-ACTION-REQUIRED** — **Have an Arabic-speaking editor review those 12 strings.**
      They are mine, not the organisation's voice. See `04-OPEN-QUESTIONS.md` B2.
- [ ] **MY-ACTION-REQUIRED** — Point `MAIL_TO_SENSITIVE` at the safeguarding focal point, not
      a shared inbox.
- [ ] **TODO** — Add a key ring to `src/lib/security/crypto.ts`: `decryptPayload` reads
      `SUBMISSION_ENC_KEY` only and ignores the row's `payload_key_id`, so the rotation that
      `DEPLOYMENT.md` §2 describes ("add a key, bump the id") is not yet possible without
      losing every existing complaint. Until it lands, the key must not be rotated. See
      `docs/RUNBOOK.md` §4.
- [ ] **TODO** — Verify DNH-8 end to end once the database grants are applied: submit a
      complaint, confirm `ip_hash` and `user_agent` are null, the payload is ciphertext, and
      no analytics event fired.
- [x] **DONE** — Mail is rendered from React Email templates (`src/emails/`) with copy in
      `src/lib/i18n/mail-dict.ts`; no Arabic subject lives in code any more. A confidential
      notification has **no `fields` prop at all** — the type refuses complaint content, not
      just the template. *Verified:* `tests/unit/mail-templates.test.ts` renders a complaint
      and a fraud report from a payload of sentinel strings and asserts none appear in the
      HTML or the plain-text part.
- [x] **DONE** — Sentry wired with scrubbing in one file for all three runtimes
      (`sentry.scrub.config.ts`): no PII, no request bodies/headers/cookies/query strings, no
      replay, no tracing. Dormant without a DSN. *Verified:* typecheck, lint, and
      `tests/unit/csp.test.ts` asserting the ingest origin enters `connect-src` only, and
      only when a DSN is set.

---

## 4. Content and routes

- [ ] **MY-ACTION-REQUIRED** — **Publish a privacy policy.** The site collects personal data
      through six forms including a confidential complaints channel, and links to a privacy
      policy that 404s. This is a data-protection exposure, not a broken link.
- [ ] **MY-ACTION-REQUIRED** — Decide on the other five absent routes the site's own
      navigation links to. Listed with their inbound links in `01-AUDIT-REPORT.md`.
- [ ] **MY-ACTION-REQUIRED** — Replace the `TODO(org):` placeholders in
      `organization_settings`. They currently render in the live homepage `<title>`.
- [x] **DONE** — `/admin/organization` is built. *Verified:* it 404ed before; it now guards
      and redirects to the login. This is where the `TODO(org):` placeholders get replaced.
- [ ] **MY-ACTION-REQUIRED** — Confirm every organisational fact in seed data is real. I did
      not verify any of them and must not invent them.

---

## 5. Before you deploy

> Full mechanics: **`docs/DEPLOYMENT.md`**. This section is the decision list; that file is
> the runbook.

- [ ] **MY-ACTION-REQUIRED** — Run `scripts/assert-rls.ts` against production.
- [ ] **MY-ACTION-REQUIRED** — Set every variable in `.env.example` in Vercel. That file was
      deleted and is restored in this audit; two error messages tell users to copy it.
- [ ] **MY-ACTION-REQUIRED** — Confirm the two cron jobs are registered and that
      `CRON_SECRET` matches. Vercel Hobby allows exactly two, which is what `vercel.json`
      declares.
- [x] **DONE** — `vercel.json` now schedules `archive-expired` **hourly** (`0 * * * *`), as
      the spec, `CLAUDE.md` and `DEPLOYMENT.md` §4c all said; it was daily.
- [x] **DONE** — Storage buckets and policies exist in the repository:
      `supabase/migrations/20260914120000_storage_buckets.sql`, idempotent. *Verified:* read
      against the live project — three buckets present with the expected limits and public
      flags, two `SELECT` policies, none on `applications`. One drift found and corrected by
      the migration: `media` allowed `image/svg+xml`.
- [ ] **MY-ACTION-REQUIRED** — Run `supabase link` + `supabase db push` once. The live
      project has no `supabase_migrations` schema yet; the push creates it and applies the
      0-byte file (no-op) and the storage file. Then run the two verification queries in
      `DEPLOYMENT.md` §3d.
- [ ] **MY-ACTION-REQUIRED** — Decide whether to run Sentry. If yes: create the project, set
      `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` in Vercel (Production), and optionally
      `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` for source maps. If no: leave
      all of them unset; nothing initialises.
- [x] **DONE** — Repository hygiene: 1,319 tracked files under `.tmp/node-compile-cache/`
      untracked and `/.tmp/` ignored; `tmp-org-smoke.ts` removed; five create-next-app
      SVGs removed from `public/`; `.github/PULL_REQUEST_TEMPLATE.md` added.
- [ ] **MY-ACTION-REQUIRED** — Decide what happens to the `main` branch pointer. See
      `04-OPEN-QUESTIONS.md` B3. Nothing has been pushed.
- [x] **DONE** — Six list routes have `loading.tsx` rendering the designed skeleton.
- [ ] **TODO** — Delete the 28 unreferenced Server Action exports. Every `'use server'`
      export is a live POST endpoint whether or not any UI calls it, so these are unaudited,
      never-manually-tested mutation endpoints in production.
- [x] **DONE** — `global-error.tsx` added. With three root layouts and nothing above them,
      a failure in any one of them had nothing to catch it.
- [ ] **MY-ACTION-REQUIRED** — Smoke-test the CMS end to end after applying `0003`: sign in,
      publish a post, upload an image, open a complaint, download a CV. Every one of those
      paths was broken by a finding in this audit; each is now fixed in code, and none has
      been exercised against the real database.
