<!--
Title: Conventional Commit — `feat(scope): …`, `fix(scope): …`, `docs: …`, `chore: …`.
The body below is the Definition of Done from docs/spec/06-BUILD-PLAN.md §11 and the
PR checklist in CLAUDE.md. Tick what you verified; strike out what does not apply and
say why. An unticked box with no explanation is a blocked review.
-->

## What

<!-- One paragraph. What changed and why. Link the milestone or audit item. -->

## Client Components added

<!-- Every new `'use client'` file needs a reason here (CLAUDE.md rule 1). "None" is fine. -->

## Checklist

- [ ] TypeScript passes with `strict` — no `any`, no `@ts-ignore`
- [ ] ESLint passes, including the logical-properties rule (`padding-inline-start`, never `padding-left`)
- [ ] Both locales verified in a browser (`/ar/…` and `/en/…`)
- [ ] RTL verified visually — Arabic is the primary drawing, not a mirror
- [ ] Keyboard-navigable; focus visible on every interactive element
- [ ] Zero new axe violations
- [ ] Server Component unless on the client allow-list, with the reason stated above
- [ ] No new third-party script on a `(site)` route
- [ ] Loading, empty, error and untranslated states handled on every list
- [ ] Mutations revalidate the correct cache tags, from the action, via `src/lib/cache/revalidate.ts`
- [ ] Admin actions guard first, then mutate, then write an audit entry
- [ ] No hardcoded copy — everything through the dictionaries
- [ ] No organisation facts in code or seed data — names, licence numbers, channels, figures read from `organization_settings` / the CMS
- [ ] Latin isolated inside Arabic with `Bidi` (phone numbers, emails, URLs, IDs)
- [ ] Every form still works with JavaScript disabled
- [ ] Conventional Commit message

## Database

<!-- Delete if no migration. -->

- [ ] `npx drizzle-kit check` clean, `drizzle/meta/_journal.json` resolves to real files
- [ ] `drizzle/` touches only `public`; `supabase/migrations/` touches only storage, auth trigger and extensions
- [ ] `npx tsx scripts/assert-rls.ts` still passes if policies, grants or the `app` schema changed

## Privacy

<!-- Delete if the change is nowhere near a form, a submission, mail, logging or error reporting. -->

- [ ] A complaint or fraud report still stores no IP hash, no user agent, fires no analytics and reaches no error tracker with its content
- [ ] No form payload reaches a log, an email body (complaints) or a Sentry event
