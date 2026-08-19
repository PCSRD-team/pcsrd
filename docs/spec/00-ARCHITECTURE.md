# 00 — System Architecture

**Project:** PCSRD institutional website
**Doc set:** `00-ARCHITECTURE` · `01-DATABASE` · `02-API` · `03-FRONTEND` · `04-DESIGN-SYSTEM` · `05-ADMIN` · `06-BUILD-PLAN` · `07-CLAUDE-CODE-BRIEF`
**Supersedes:** parts of `PCSRD-Website-Specification.md` v1.0 — see §0.1

---

## 0.1 Changes from spec v1.0

| # | Change | Consequence |
|---|---|---|
| 1 | **Donations are a WhatsApp link only.** No payment gateway, ever. | `/get-involved/support` becomes a content page whose only conversion is a `wa.me` deep link. No Stripe, no PayPal, no `payments` table, no webhook handler, no PCI surface. Phase 3 donation work is deleted from the roadmap. |
| 2 | **Data verification is out of the developer's scope.** | `impact_metrics.status` stays in the schema (3 lines of SQL, and it makes the public query a clean `where status = 'verified'`), but no editorial gate, no approval workflow, no blocking validation. The organization owns what it publishes. |
| 3 | **CMS changed from Sanity to a self-built admin on Supabase.** | v1.0 recommended Sanity for zero ops. That assumed the org maintains the site alone. You are the maintainer, Supabase is your stack, and a self-owned bilingual CMS is a materially stronger portfolio artifact. **Trade-off accepted:** you now own the admin UI — roughly 30–40% of total build effort (see `05-ADMIN`), against zero vendor lock-in, no 3-seat free-tier ceiling, and full data ownership. |

Everything else in v1.0 (IA, sitemap, personas, page specs, content strategy, do-no-harm rules) stands unchanged.

---

## 0.2 Architecture at a glance

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (ar / en · RTL / LTR · mobile-first)                │
└───────────────┬──────────────────────────────────────────────┘
                │ HTTPS
┌───────────────▼──────────────────────────────────────────────┐
│  Cloudflare  — DNS · WAF · DDoS · Turnstile                  │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│  Vercel — Next.js 15/16 App Router                           │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │  (site)        │  │  (admin)       │  │  api/          │  │
│  │  RSC, static   │  │  RSC + client  │  │  route handlers│  │
│  │  ISR + tags    │  │  dynamic, auth │  │  feed, health  │  │
│  │  ~0 client JS  │  │  Server Actions│  │  cron, revalid.│  │
│  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘  │
│          └───────────────────┴───────────────────┘           │
│                          │ Drizzle ORM                        │
└──────────────────────────┼───────────────────────────────────┘
                           │ postgres-js · Supavisor pooler :6543
┌──────────────────────────▼───────────────────────────────────┐
│  Supabase                                                    │
│   • Postgres      — all content + submissions + audit        │
│   • Auth          — admin users only (no public accounts)    │
│   • Storage       — media (public) · documents (public)      │
│                     applications (private, signed URLs)      │
└──────────────────────────────────────────────────────────────┘

Side services:  Resend (mail) · Upstash Redis (rate limit) ·
                Umami/Plausible (analytics) · Sentry (errors)
```

---

## 0.3 Stack

| Layer | Choice | Version | Why this and not the obvious alternative |
|---|---|---|---|
| Framework | Next.js App Router | 15.x or 16.x | RSC keeps the public site near-zero client JS — the §19 perf budget is unreachable with a client-rendered SPA. Pin the exact minor at install; all APIs used here are stable in 15+ (`params`/`searchParams` as Promises, Server Actions, `after()`, `revalidateTag`). |
| Language | TypeScript | 5.x, `strict: true` | — |
| UI runtime | React | 19 | `useActionState`, `useFormStatus`, `use()` |
| Styling | Tailwind CSS v4 (`@theme` CSS-first) | 4.x | Logical properties are first-class; one stylesheet serves RTL and LTR. *Fallback:* v3 + `tailwind.config.ts` if a dependency forces it — token names in `04-DESIGN-SYSTEM` are identical either way. |
| Components | shadcn/ui (Radix) | latest | Source-owned, so RTL fixes are local edits, not upstream PRs. |
| Database | Supabase Postgres | 15+ | Your stack. Real relational modelling (junctions, enums, arrays) that a document CMS makes awkward. |
| ORM | **Drizzle** | latest | Typed SQL over the direct connection. Chosen over `supabase-js`/PostgREST: no HTTP hop from the server, real joins, no `.select('*, partners(*)')` string typing, migrations generated from the schema. |
| Auth | Supabase Auth (`@supabase/ssr`) | latest | Admin only. Used for session + Storage signing — **not** for data access. |
| Rich text | TipTap JSON, stored as `jsonb` | latest | Editor produces a validated AST; a server renderer maps nodes → components. HTML injection is structurally impossible — no `dangerouslySetInnerHTML` anywhere in the codebase. |
| Forms | Server Actions + Zod + `useActionState` | — | Chosen over React Hook Form: forms work with JS disabled, and RHF would ship ~12KB for six simple forms. |
| i18n | **Custom, server-only** | — | Two locales, ~220 chrome strings. `next-intl` is good but ships a client provider; here all chrome renders in RSC, so dictionaries never reach the browser. |
| Email | Resend + React Email | — | — |
| Rate limit | Upstash Redis + `@upstash/ratelimit` | — | Serverless-native; free tier covers this traffic by orders of magnitude. |
| Bot | Cloudflare Turnstile | — | Privacy + weight vs reCAPTCHA. |
| Analytics | Umami (self-host) or Plausible | — | Cookieless → no consent banner → no modal on a 3G phone. |
| Errors | Sentry, `sendDefaultPii: false` | — | — |
| Hosting | Vercel + Cloudflare DNS | — | — |
| CI | GitHub Actions | — | typecheck · lint · unit · e2e · axe · Lighthouse budgets |

---

## 0.4 The four architectural decisions worth defending

### D1 — All database access is server-side; RLS is a tripwire, not the control

Every query runs on the server through Drizzle over the direct Postgres connection. The browser never talks to Supabase.

```sql
alter table programs enable row level security;
-- deliberately zero policies for anon / authenticated
```

RLS is enabled on **every** table with **no** policies granted to `anon` or `authenticated`. The app connects as the table owner, which bypasses RLS.

Why this shape:
- **Authorization lives in one place** — the `requireRole()` guard in `lib/auth/guard.ts` — not scattered across SQL policies that are easy to get subtly wrong and hard to test.
- **If the anon key ever leaks, the blast radius is zero.** No policy = no rows. This is the tripwire.
- Consistent with your CSH decision (single data-access layer, RLS off). Here you get the safety net for free.

The one place RLS genuinely does work: **Storage**. The `applications` bucket (CVs) has no public policy and is reachable only through server-generated signed URLs.

### D2 — Bilingual via paired columns, not JSONB

`title_ar` / `title_en`, not `title jsonb`.

| | Paired columns | JSONB |
|---|---|---|
| Type safety | Full — Drizzle infers `string` and `string \| null` | `unknown`, needs a cast at every read |
| Constraints | `title_ar not null`, `title_en null` expresses "Arabic required, English optional" natively | Application-level only |
| Indexing | `create index on posts (slug_en)` | Expression index, awkward |
| Full-text search | Per-language `tsvector` with the right dictionary | Painful |
| Cost | Schema churn if a 3rd locale appears | Free |

No third locale is justified by any source, and this matches the AR/EN column pattern you already shipped on OnlineMihna. Decision closed.

### D3 — Public forms are Server Actions, not REST endpoints

```tsx
<form action={submitPartnershipInquiry}>   // works with JS disabled
```

- Progressive enhancement is real here — §12.3, intermittent connectivity.
- Type-safe end to end; no fetch wrapper, no manual serialization.
- Rate limiting works identically (`headers()` is available inside an action).
- Turnstile still works: the widget injects a hidden `cf-turnstile-response` input, which is just a form field.

REST route handlers are reserved for **machine consumers only**: `/feed.xml`, `/api/health`, `/api/cron/*`. Six form endpoints that no third party will ever call do not need to be REST.

### D4 — One Next.js app, two route groups, one deploy

`(site)` and `(admin)` are route groups in the same application, not separate services.

- Shared types, shared Zod schemas, shared DB layer — no API contract to keep in sync between two repos.
- `(site)` is static/ISR; `(admin)` is `force-dynamic`. The rendering strategy is per-route-group, so the admin's dynamism never contaminates the public site's cacheability.
- One deploy, one env, one CI pipeline. A separate backend service would add an HTTP hop, a second deploy target, and CORS — for zero benefit at this scale.

---

## 0.5 Rendering & caching strategy

| Route group | Strategy | Revalidation |
|---|---|---|
| `(site)` content routes | `generateStaticParams` + ISR | Tag-based: `revalidateTag()` fired from admin Server Actions on publish |
| `(site)/projects` (faceted) | Dynamic, `searchParams`-driven, cached per filter combo | Tag `project:list` |
| `(site)` forms | Static shell + Server Action | — |
| `(admin)/**` | `export const dynamic = 'force-dynamic'` | Never cached |
| `api/**` | Dynamic | — |

**Cache tag convention** — one namespace per entity, one tag per record:

```
org:settings
program:list          program:{slug}
project:list          project:{slug}
post:list             post:{slug}
story:list            story:{slug}
vacancy:list          vacancy:{slug}
partner:list
metric:list
person:list
publication:list
page:{slug}
```

Every mutation in the admin calls the matching `revalidateTag()` calls. A publish is therefore instant on the public site while the site itself is still served statically.

---

## 0.6 Repository structure

```
pcsrd-web/
├── .env.example
├── .github/workflows/ci.yml
├── components.json                 # shadcn config
├── drizzle.config.ts
├── middleware.ts
├── next.config.ts
├── package.json
├── playwright.config.ts
├── tsconfig.json
├── vitest.config.ts
│
├── drizzle/                        # generated SQL migrations (app tables)
│   ├── 0000_init.sql
│   ├── 0001_….sql
│   └── meta/
│
├── supabase/                       # Supabase-managed concerns ONLY
│   ├── config.toml
│   └── migrations/
│       ├── 00_storage_buckets.sql
│       ├── 01_storage_policies.sql
│       └── 02_auth_trigger_profiles.sql
│
├── public/
│   ├── fonts/                      # subsetted WOFF2 (self-hosted)
│   ├── icons/
│   └── og-fallback.png
│
├── scripts/
│   ├── seed.ts
│   ├── subset-fonts.sh
│   └── purge-expired-submissions.ts
│
└── src/
    ├── app/                        # → 03-FRONTEND §2
    ├── components/                 # → 04-DESIGN-SYSTEM §3
    ├── db/                         # → 01-DATABASE §5
    ├── lib/                        # → 02-API §6
    ├── i18n/                       # → 03-FRONTEND §5
    ├── styles/
    └── types/
```

**Migration ownership split** — this matters, and getting it wrong creates two sources of truth:

| Directory | Owns | Applied by |
|---|---|---|
| `drizzle/` | All application tables, enums, indexes, triggers, functions | `drizzle-kit generate` → `drizzle-kit migrate` |
| `supabase/migrations/` | Storage buckets + policies, `auth.users` → `profiles` trigger, `pg_cron` jobs | Supabase CLI |

Nothing in `supabase/migrations/` touches an application table. Nothing in `drizzle/` touches an `auth.*` or `storage.*` object.

---

## 0.7 Environment variables

```bash
# ── Database ───────────────────────────────────────────────
# Pooler, transaction mode, port 6543 → REQUIRED for serverless
DATABASE_URL="postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres"
# Direct connection, port 5432 → migrations only (pooler can't run DDL sessions)
DIRECT_URL="postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres"

# ── Supabase (auth + storage only) ─────────────────────────
NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="…"
SUPABASE_SERVICE_ROLE_KEY="…"          # server only — never NEXT_PUBLIC_

# ── Site ───────────────────────────────────────────────────
NEXT_PUBLIC_SITE_URL="https://<canonical-domain>"
NEXT_PUBLIC_DEFAULT_LOCALE="ar"

# ── Email ──────────────────────────────────────────────────
RESEND_API_KEY="…"
MAIL_FROM="PCSRD <noreply@<domain>>"
MAIL_TO_GENERAL="…"
MAIL_TO_PARTNERSHIP="…"
MAIL_TO_HR="…"
MAIL_TO_SENSITIVE="…"                  # complaints — restricted recipients

# ── Anti-abuse ─────────────────────────────────────────────
NEXT_PUBLIC_TURNSTILE_SITE_KEY="…"
TURNSTILE_SECRET_KEY="…"
UPSTASH_REDIS_REST_URL="…"
UPSTASH_REDIS_REST_TOKEN="…"

# ── Privacy ────────────────────────────────────────────────
IP_HASH_SALT="<32-byte random>"        # submissions store sha256(ip+salt), never raw IP

# ── Ops ────────────────────────────────────────────────────
CRON_SECRET="<random>"                  # guards /api/cron/*
SENTRY_DSN="…"
NEXT_PUBLIC_ANALYTICS_URL="…"
NEXT_PUBLIC_ANALYTICS_SITE_ID="…"

# ── Contact ────────────────────────────────────────────────
NEXT_PUBLIC_WHATSAPP_NUMBER="970595889697"   # digits only, no + — wa.me format
```

> `DATABASE_URL` on **:6543** and `DIRECT_URL` on **:5432** is not optional. Supavisor transaction mode does not support prepared statements or session-level DDL — `postgres-js` must be created with `prepare: false`, and migrations must use the direct URL or they will fail intermittently and confusingly.

---

## 0.8 Naming conventions

| Thing | Convention | Example |
|---|---|---|
| DB tables | `snake_case`, plural | `impact_metrics` |
| DB columns | `snake_case`; locale suffix last | `strategic_objective_ar` |
| DB enums | `snake_case`, singular | `content_status` |
| Drizzle schema files | one per domain | `src/db/schema/projects.ts` |
| Query modules | one per entity, `get*` / `list*` | `src/db/queries/projects.ts` |
| React components | `PascalCase.tsx` | `ProgramCard.tsx` |
| Client components | `'use client'` on line 1, filename suffixed | `ProjectFilters.client.tsx` |
| Server Actions | `actions.ts`, colocated with the route | `.../partner/actions.ts` |
| Zod schemas | `src/lib/validation/<domain>.ts`, export `xSchema` + `XInput` | `partnershipSchema` |
| Routes | kebab-case | `/get-involved/partner` |
| Cache tags | `entity:scope` | `project:list` |
| Git | Conventional Commits | `feat(admin): add bilingual field component` |

---

## 0.9 Non-negotiable rules

These are enforced in review and, where possible, in CI.

1. **No `dangerouslySetInnerHTML`.** Anywhere. Rich text renders through the TipTap node map (`04-DESIGN-SYSTEM §5`). Add an ESLint rule.
2. **No `margin-left` / `padding-right` / `text-align: left`.** Logical properties only, or RTL silently breaks. ESLint plugin + a visual regression test in both directions.
3. **No client component without a written reason.** The allow-list is in `03-FRONTEND §4`. Anything not on it needs justification in the PR.
4. **No third-party script on any `(site)` route** except the ~2KB analytics beacon.
5. **Every Zod schema is imported by both the client form and the server action.** One definition. No parallel validation.
6. **Every published number renders with its period.** `MetricCard` requires `periodStart`/`periodEnd` props — TypeScript enforces it.
7. **`alt` is required on every image.** `media_assets.alt_ar` is `not null`; the uploader will not submit without it.
8. **EXIF is stripped in the upload pipeline**, server-side, before the file reaches Storage. Not a checkbox.
9. **Raw IPs are never stored.** `sha256(ip + IP_HASH_SALT)` only, and `NULL` for sensitive submissions.
10. **Secrets never in `NEXT_PUBLIC_*`.** CI greps for `SERVICE_ROLE` in the client bundle and fails the build.
