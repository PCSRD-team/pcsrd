# 07 — Claude Code Handoff Brief

Copy **everything inside the code block below** as the opening prompt for Claude Code. It is written to be complete on its own, but it also points at the other plan documents, which must be present in the repo at `docs/plan/`.

```
# PROJECT BRIEF — PCSRD institutional website

## 0. Before you write any code

Read these files in the repository, in this order, and do not begin implementation
until you have read all of them:

  docs/plan/00-ARCHITECTURE.md      system design, stack, non-negotiable rules
  docs/plan/01-DATABASE.md          full schema, DDL, RLS, storage, Drizzle setup
  docs/plan/02-API.md               server actions, route handlers, queries, security
  docs/plan/03-FRONTEND.md          route inventory, file tree, i18n, perf
  docs/plan/04-DESIGN-SYSTEM.md     tokens, RTL rules, component contracts
  docs/plan/05-ADMIN.md             admin CMS specification
  docs/plan/06-BUILD-PLAN.md        milestones and definition of done

These documents are the specification. Where this brief and those documents
disagree, the documents win. Where both are silent, ASK — do not invent.

## 1. What we are building

A bilingual (Arabic RTL / English LTR) institutional website for a Palestinian
non-profit operating in the Gaza Strip. It has three purposes, in priority order:

  1. Pass institutional donor due diligence (the primary conversion is a
     partnership inquiry, not a donation)
  2. Protect the community from impersonation (a /verify page listing official
     channels — the organization has a documented aid-fraud problem)
  3. Let non-technical Arabic-speaking staff publish news, projects, and vacancies

There is NO payment integration. Support/donation is a WhatsApp deep link only.
Do not add Stripe, PayPal, or any checkout, in any phase, even if it seems helpful.

## 2. Stack — do not substitute without asking

  Next.js App Router (15.x/16.x) · TypeScript strict · React 19
  Tailwind CSS v4 (CSS-first @theme) · shadcn/ui
  Supabase Postgres · Drizzle ORM · Supabase Auth (admin only) · Supabase Storage
  Zod · Server Actions · Resend · Upstash Ratelimit · Cloudflare Turnstile
  Vercel · pnpm

Critical connection detail: DATABASE_URL uses the Supavisor pooler on port 6543
and postgres-js MUST be created with { prepare: false }. Migrations use
DIRECT_URL on port 5432. Getting this wrong produces intermittent, confusing
failures. Verify it works before building anything on top of it.

## 3. Ten rules that are never violated

  1. No dangerouslySetInnerHTML anywhere except src/components/seo/* for JSON-LD.
     Rich text renders through the TipTap node map in 04-DESIGN-SYSTEM §3.4.
  2. No physical CSS properties. Use ms/me, ps/pe, start/end, text-start/text-end,
     border-s/border-e. Physical properties silently break RTL.
  3. Server Components by default. Client components only from the allow-list in
     03-FRONTEND §4. Anything else needs explicit justification.
  4. No third-party scripts on any (site) route except the analytics beacon and
     Turnstile (Turnstile only on the four routes that have forms).
  5. Every Zod schema is imported by BOTH the client form and the server action.
     One definition, never two.
  6. MetricCard requires periodStart and periodEnd props. A number without its
     period must be impossible to render.
  7. media_assets.alt_ar is NOT NULL. Uploads without Arabic alt text are rejected.
  8. EXIF/GPS is stripped server-side in the upload pipeline (sharp .rotate() then
     encode, never withMetadata()). This is a safety requirement, not an
     optimization — field photos carry coordinates.
  9. Raw IP addresses are never stored. Store sha256(ip + IP_HASH_SALT). For
     complaint submissions store NULL for both ip_hash and user_agent, and fire
     no analytics event.
 10. No secret in a NEXT_PUBLIC_* variable. CI greps the client bundle for
     service_role and fails the build.

## 4. Build order

Follow 06-BUILD-PLAN.md milestones M0 → M7 in sequence. Do not jump ahead.
Two ordering rules that are easy to get wrong and expensive to undo:

  - Build the homepage LAST within M3. It composes components from every other
    page; building it first means building each component twice.
  - Build the Projects entity FIRST and completely within M5. It is the most
    complex (two junction tables, enum arrays, media gallery, SEO block). Once
    it works, the other ten entities are field configs, not new screens.

## 5. Verification required at each step — investigate, do not assume

Before acting on any of the following, verify it in the actual environment and
report what you found:

  - Confirm the installed Next.js major version and whether params/searchParams
    are Promises in it. Do not assume; check package.json and the running app.
  - Confirm Tailwind v4 is installed and the @theme block compiles. If a
    dependency forces v3, STOP and ask before converting the token file.
  - Confirm postgres-js connects through the pooler with prepare:false by running
    an actual query, before writing any query modules.
  - Confirm which shadcn components ship physical CSS properties by reading the
    generated source after install, and fix them in place. Do not assume the
    list in 04-DESIGN-SYSTEM §3.1 is exhaustive.
  - Confirm the Arabic font renders in next/og (Satori) by generating one OG
    image early in M6. It fails silently if the font is not passed as an
    ArrayBuffer. Do not leave this to the end.
  - Confirm sharp is available in the Vercel runtime for the chosen Node version
    before building the upload pipeline on it.
  - Before creating any table, check whether it already exists in the migration
    history. Never write a migration that duplicates an existing one.

If any verification fails, report the finding and the options — do not silently
work around it or substitute a different library.

## 6. What to ask about rather than decide

  - Any change to the stack in §2
  - Any new npm dependency (state what it is for, its size, and what it replaces)
  - Any deviation from the database schema in 01-DATABASE.md
  - Any new client component not on the allow-list
  - Any new route not in the 24-route inventory in 03-FRONTEND §1
  - Anything that would add a third-party script to a public route
  - Anything the plan documents do not cover

## 7. Definition of done — per pull request

  [ ] tsc --noEmit passes; no any, no @ts-ignore
  [ ] eslint passes including the physical-properties rule
  [ ] Verified in the browser in BOTH locales, and RTL checked visually
  [ ] Keyboard navigable, focus visible
  [ ] No new axe violations
  [ ] Server Component unless allow-listed, with the reason stated in the PR body
  [ ] Loading, empty, and untranslated states all handled
  [ ] Mutations call the correct revalidateTag calls for BOTH locale slugs
  [ ] Admin actions call a guard as their first statement and write an audit entry
  [ ] Conventional Commits message

## 8. Edge cases that must be handled, not discovered later

  - An English route whose record has translation_status = 'ar_only': render the
    Arabic body inside a "translation coming soon" notice, omit hreflang for that
    page, set robots noindex. Never auto-translate. Never render blank.
  - Localized slugs: /ar/programs/الحماية and /en/programs/protection are the same
    record. The language switcher must map to the equivalent page, not the home
    page. Arabic slugs stay in Arabic script; do not transliterate.
  - A vacancy past its deadline must stop rendering as open. The cron handler
    archives it AND calls revalidateTag — archiving without revalidating leaves a
    closed vacancy visible for up to an ISR window.
  - A partner whose logo_permission is not 'granted' renders as text, never as an
    image. Enforce this in the query, not in the component.
  - A person whose is_public is false never appears on the public site. Default
    is false; publishing a person is an explicit act.
  - A media asset with has_identifiable_minors = true and consent != 'obtained'
    blocks publication of any entity that references it.
  - Latin text and digits inside Arabic prose need <bdi dir="ltr"> isolation or
    they render in the wrong order. This applies to phone numbers, emails, URLs,
    licence numbers, and donor names like UNICEF and OCHA.
  - Forms must submit with JavaScript disabled. Test this explicitly; it is the
    reason Server Actions were chosen and it regresses silently.
  - Deleting a media asset that is still referenced must be refused with a list
    of what references it, not cascade into dangling FKs.

## 9. Content and copy

All Arabic content comes from the client's strategic plan and will be loaded
through the admin in M7. During development, use the seed script. Do not write
placeholder Arabic copy that could be mistaken for real organizational content,
and do not invent facts about the organization — no statistics, no dates, no
donor names, no beneficiary numbers. If a component needs example data, use the
seed fixtures and mark them clearly.

## 10. First task

Execute M0 from 06-BUILD-PLAN.md §2:

  1. Scaffold the Next.js app with the exact flags listed
  2. Install the dependency set
  3. Create the Supabase project connection and verify BOTH connection strings
     work — the pooler for queries, the direct URL for DDL
  4. Set up the CI workflow from 06-BUILD-PLAN.md §10
  5. Create /api/health and confirm it returns {status:'ok'} on a Vercel preview
  6. Write CLAUDE.md at the repo root containing: the stack, the ten rules from
     §3 above, the naming conventions from 00-ARCHITECTURE §0.8, and an
     instruction to read docs/plan/* before changing architecture

Report back with: the versions actually installed, the results of each
verification in §5 that applies at this stage, and anything in the plan
documents that conflicts with what you found in the real environment.
```

---

## Notes on using this brief

**Session structure.** One Claude Code session per milestone. Starting a fresh session at each milestone boundary keeps context focused; paste this brief plus the relevant plan document at the start of each.

**Per-milestone follow-up prompt** — replace the milestone reference:

```
Continue with M<N> from docs/plan/06-BUILD-PLAN.md.

Before starting: re-read docs/plan/<the documents relevant to this milestone>
and confirm what already exists in the repo from previous milestones. Do not
recreate anything that is already there.

Constraints from the original brief still apply in full — especially the ten
rules, the client-component allow-list, and the per-PR definition of done.

Work through the milestone's tasks in the listed order. After each task, state
what you did and what you verified. Stop and ask if you hit anything the plan
documents do not cover, or anything that contradicts what you find in the repo.
```

**Review prompt** — for Opus to check Sonnet's output at the end of each milestone:

```
Review the work completed for M<N> against docs/plan/06-BUILD-PLAN.md §<N> and
the per-PR definition of done in §11.

Check specifically:
  - Any physical CSS property that would break RTL
  - Any client component not on the 03-FRONTEND §4 allow-list
  - Any mutation that does not revalidate both locale slugs
  - Any admin action whose first statement is not a guard
  - Any query that does not filter status = 'published' on a public route
  - Any Zod schema duplicated between client and server
  - Any use of dangerouslySetInnerHTML outside src/components/seo/
  - Any place where a raw IP, a beneficiary name, or a form payload is logged

Report findings as: blocking / should-fix / nitpick. Do not fix anything yet —
list the findings first so I can decide the order.
```
