@AGENTS.md

# PCSRD web — working conventions

Read `docs/spec/00-ARCHITECTURE.md` through `07` and
`docs/design_handoff/README.md` before changing architecture or visual system.
Work milestone by milestone from `docs/spec/06-BUILD-PLAN.md`.

## Stack

Next.js **16** App Router · TypeScript strict · Tailwind v4 · shadcn/ui · Supabase Postgres ·
Drizzle (app tables) · Supabase CLI (storage, policies, triggers) · Resend + React Email ·
Upstash rate limiting · Vercel. Package manager: **npm** (not pnpm — the spec's commands
assume pnpm, translate them).

## The non-negotiables

1. **Server Components by default.** A client component needs a reason stated in the PR.
2. **Logical CSS properties only** — never `padding-left`, `margin-right`, `left`,
   `border-left`. The ESLint rule stays on.
3. **Arabic is the default locale.** RTL is the primary drawing, not a mirror.
4. **Isolate Latin inside Arabic** with the `Bidi` component. Phone numbers, emails,
   URLs, licence numbers, IDs — all of them.
5. **No hardcoded copy.** Everything goes through the dictionaries.
6. **No organisation facts in code.** Names, licence numbers, channels and figures read
   from `organization_settings` / the CMS.
7. **Every form works with JavaScript disabled.** Server Actions, no exceptions.
8. **Admin: guard first, then mutate, then write an audit entry.**
9. **Mutations revalidate the correct cache tags.**
10. **Every list has designed loading, empty, error and untranslated states.** See
    `docs/design_handoff/design/PCSRD States & Audit.dc.html`.

## Layering — three rules, mechanically enforced

> **`src/db/queries/*` — how to read.** Drizzle only. Knows tables, joins,
> `status = 'published'`, locale resolution, cache tags. Does not know *who* is asking.
> Public queries are `unstable_cache`-wrapped; `queries/admin/*` never are.
>
> **`src/services/*` — what the rules are.** Transactions, invariants, junction
> hydration, audit entries, permission *rules*, retention policy, consent gates.
> **Imports nothing from `next/*`** — an ESLint `no-restricted-imports` rule scoped to
> `src/services/**` enforces this. Takes an `Actor` plus validated input, returns a plain
> result. Callable from an action, a route handler, a cron job, a seed script, or a test
> with zero mocking.
>
> **`src/actions/*` — how the web calls it.** `'use server'`. Guard → `FormData` → object
> → Zod → call the service → `revalidateTag` → map thrown errors to `ActionResult`.
> **No business logic.** An `if` that is not about HTTP or validation belongs in a service.

Services throw `AppError`; actions catch it via `runAction()` and return `ActionResult`.
A service never constructs an `ActionResult` — that is an HTTP concern.

`revalidateTag` lives in the action, never the service: it is a Next-runtime concern and
importing `next/cache` into a service would break testability.

## Next.js 16 — where the spec docs are stale

The spec was written against Next 15. These are verified from
`node_modules/next/dist/docs/`:

| Spec says | Next 16 actually |
|---|---|
| `middleware.ts` | **`src/proxy.ts`**, exporting `proxy`. Node runtime only; `export const runtime` throws. `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`. |
| `revalidateTag(tag)` | **Second argument required**: `revalidateTag(tag, { expire: 0 })` for immediate, `revalidateTag(tag, 'max')` for stale-while-revalidate. Contained in `src/lib/cache/revalidate.ts` — call that, not `next/cache` directly. |
| — | `updateTag()` and `refresh()` are new, Server-Action-only. Not used here (they target `use cache` tags, not `unstable_cache` tags). |
| `unstable_cache` | Still works. Superseded by `'use cache'`, which needs `cacheComponents: true`. |
| `experimental.ppr` / `dynamicIO` | **Removed.** Both are folded into top-level `cacheComponents`. |
| `<Image priority>` | Deprecated → `preload`. Also: `minimumCacheTTL` default is now 14400. |
| `params` / `searchParams` / `cookies()` / `headers()` | All async. Synchronous access is **fully removed**, not just deprecated. |

**`cacheComponents` stays OFF.** Turning it on makes `unstable_cache`,
`export const revalidate` and `export const dynamic = 'force-dynamic'` all error, and the
entire caching design in `docs/spec/02-API.md` depends on those three. There is a comment
saying so in `next.config.ts`; do not enable it casually.

Typegen helpers `PageProps<'/route'>`, `LayoutProps<'/route'>`, `RouteContext<'/route'>`
are globally available after `next dev` / `next build` — use them instead of hand-typing
`{ params: Promise<...> }`.

## Deliberate deviations from the spec

- **Server Actions live in `src/actions/`**, not colocated as `actions.ts` next to each
  route (`00-ARCHITECTURE §0.8`). The backend is built before the routes exist, and this
  makes "action layer" a real layer. When routes arrive, a colocated file may re-export
  from here in one line. **Do not "fix" this back.**
- **`organization_settings.values` is named `core_values`** — `VALUES` is a fully reserved
  Postgres keyword and any raw `db.execute(sql\`…\`)` touching it would fail permanently.
- **Upload cap is 4 MB**, not the spec's 5/10 MB — Vercel's serverless request body limit
  is 4.5 MB, so a larger file is rejected with an opaque 413 before validation ever runs.
  Enforced in the Zod schema, the route handler, and the bucket `file_size_limit`.
- **CSP: nonce on `(admin)` only.** Reading `headers()` for a nonce opts a subtree out of
  static generation, which `(site)` requires. `(site)` gets a static CSP from
  `next.config.ts` `headers()`. The injection vector this would defend against is already
  closed by the no-`dangerouslySetInnerHTML` rule and the no-third-party-scripts rule.
- **Confidential attachments are refused, not gated.** `02-API §6.5` and `05-ADMIN §7`
  contradict each other; the stricter one wins.

## Database ownership — do not cross the line

`drizzle/` owns every application table, enum, index, trigger and function.
`supabase/migrations/` owns storage buckets and policies, the `auth.users → profiles`
trigger, and extensions. Nothing in one touches the other.

**Never run `supabase db pull` or `supabase db diff` against the `public` schema.** It
will see Drizzle's tables as untracked drift and write them into `supabase/migrations/`,
producing exactly the two-sources-of-truth failure the split exists to prevent.

`supabase/migrations/20260819113741_remote_schema.sql` is 0 bytes on purpose. Its version
is recorded in the remote `supabase_migrations.schema_migrations` table — deleting the
local file makes `supabase migration list` report a phantom remote-only version forever.

## Infrastructure notes

- Supabase project `ouyivpcvowkpcfiqduyx` is in **ap-northeast-1 (Tokyo)**. Vercel
  functions must be pinned to **`hnd1`** to co-locate with it, or every uncached query
  pays a cross-Pacific round trip.
- `DATABASE_URL` is the pooler on **:6543** and `postgres-js` must be created with
  `{ prepare: false }`. `DIRECT_URL` is **:5432** and is for DDL only. Getting this wrong
  fails intermittently with an error that does not point at the cause.
- `drizzle-kit` is a standalone binary and does **not** inherit Next's env loading —
  `drizzle.config.ts` imports `dotenv/config` explicitly.

## Design system in one screen

Paper `#FBFAF6` on ground `#E5E2DA`, navy ink `#14213F`, gold `#DD991C` as a marking
colour only — rule, stamp, focus ring, never a fill and never text on paper (use
`#B87B12` for gold text). **Radius 0. No shadows.** Hierarchy comes from three rule
weights: 1px `#D8D3C7` edge · 2px `#14213F` section boundary · 2px×88px gold heading
mark. IBM Plex Sans Arabic for text, IBM Plex Mono for eyebrows, codes and dates.
Content max width 1180px; prose 52–78ch. Full table in `docs/design_handoff/README.md`.

The `.dc.html` files in `docs/design_handoff/design/` are **references, not code**. Read
their measurements, colours and states; rebuild as Server Components with Tailwind
tokens. Do not port their inline styles. `image-slot.js` and `support.js` exist only to
make the prototypes run — do not port them either.

## Never do

- Invent a fact about the organisation — including in seed data that could reach production.
- Add a fourth rule weight, a shadow, or a border radius.
- Use `gold-600` for text on paper.
- Publish an impact figure without its period and verification status.
- Publish media without `alt_ar`.
- Let a complaint submission store an IP hash or fire an analytics event.
- Add a third-party script to a `(site)` route.
- Ship a photograph of an identifiable child without documented consent.

## PR checklist

Typecheck strict, no `any`, no `@ts-ignore` · ESLint incl. physical-properties rule ·
both locales checked in a browser · RTL verified visually · keyboard-navigable, focus
visible · zero new axe violations · loading/empty/untranslated handled · correct cache
tags revalidated · Conventional Commit.
