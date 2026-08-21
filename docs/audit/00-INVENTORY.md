# 00 — Verified Ground Truth (Phase 0)

Read-only discovery. Every row below was verified by reading a file or running a
command in this repository. Nothing here is inferred from convention.

Audit branch: `chore/pre-launch-audit` · Working tree clean at start · `main` untouched.

---

## 1. Toolchain

| Item | Verified value | Evidence |
|---|---|---|
| Package manager | npm 11.17.0 — `package-lock.json` present, lockfileVersion 3. No `pnpm-lock.yaml`, `yarn.lock`, or `bun.lockb`. | `npm -v` [VERIFIED-EXEC]; root listing |
| Node (local) | v24.19.0 | `node -v` [VERIFIED-EXEC] |
| Node (CI) | 24 | `.github/workflows/ci.yml:12` |
| `.nvmrc` / `engines` | **not present** | root listing; `package.json` |

## 2. Framework and libraries

Read from `node_modules/*/package.json`, not from the semver ranges.

| Package | Installed version |
|---|---|
| next | 16.3.1 |
| react / react-dom | 19.2.8 |
| typescript | 5.9.3 |
| tailwindcss | 4.3.3 |
| drizzle-orm | 0.45.2 |
| drizzle-kit | 0.31.10 |
| zod | 4.4.3 |
| @supabase/ssr | 0.12.4 |
| @supabase/supabase-js | 2.112.3 |
| vitest | 4.1.11 |
| eslint | 9.39.5 |

Other runtime dependencies declared in `package.json`: `@react-email/components`,
`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@upstash/ratelimit`,
`@upstash/redis`, `clsx`, `date-fns`, `file-type`, `postgres`, `resend`, `server-only`,
`sharp`, `tailwind-merge`.

## 3. Application topology

- **Not a monorepo.** Single Next.js app, `src/` layout, one `package.json`.
- **App Router only.** No `pages/` directory anywhere.
- Route groups: `(site)`, `(admin)`, `(admin-auth)`.
- Middleware file is **`src/proxy.ts`** (the Next 16 rename). No `middleware.ts`.
- `src/` contains 162 files: 80 `.tsx`, 80 `.ts`, plus `globals.css` and `favicon.ico`.
  Total is about 17,600 lines across `.ts`/`.tsx`/`.css`.
- 219 files tracked by git across 9 commits.

### Public routes present, under `src/app/(site)/[locale]/`

`/` · `/about` · `/careers` · `/careers/[slug]` · `/contact` ·
`/get-involved/partner` · `/get-involved/volunteer` · `/impact` ·
`/impact/stories/[slug]` · `/legal/[slug]` · `/news` · `/news/[slug]` ·
`/partners` · `/programs` · `/programs/[slug]` · `/projects` · `/projects/[slug]` ·
`/resources` · `/verify`

### Public routes specified but ABSENT

`/about/vision-mission` · `/about/governance` · `/about/strategy` ·
`/about/memberships` · `/get-involved` (index) · `/get-involved/support`

Measured against the 24-route inventory in `docs/spec/03-FRONTEND.md` section 1.

### App Router special files

Present: `src/app/(site)/[locale]/error.tsx`, `src/app/(site)/[locale]/not-found.tsx`,
`src/app/layout.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/favicon.ico`.

**Absent anywhere in the tree:** `loading.tsx`, `global-error.tsx`, root `not-found.tsx`,
`manifest.ts`, `opengraph-image.tsx`.

## 4. TypeScript configuration

From `tsconfig.json`:

- `strict: true` · `noEmit: true` · `target: ES2017` · `module: esnext` ·
  `moduleResolution: bundler` · `jsx: react-jsx` · `incremental: true`
- Path alias: `@/*` maps to `./src/*`
- **`noUncheckedIndexedAccess` is NOT set.**

## 5. Styling

- Tailwind **v4**, CSS-first. The `@theme` block lives in `src/app/globals.css`
  (162 lines); there is no `tailwind.config.*`. PostCSS plugin: `@tailwindcss/postcss`.
- **No `components.json` and no shadcn/ui dependency**, despite `CLAUDE.md` and
  `docs/design_handoff/README.md` both listing shadcn/ui in the stack.
- No second UI system. Only `clsx` + `tailwind-merge`.
- Fonts come from `next/font/google` (`IBM_Plex_Sans_Arabic`, `IBM_Plex_Mono`) in
  `src/app/layout.tsx:21-31`, downloaded at build time and served same-origin.
- `public/` contains **only** the five default create-next-app SVGs
  (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`). No fonts, no icons,
  no OG fallback image.

## 6. Data and state

- **Drizzle + postgres-js** over the direct connection. Single client in
  `src/db/index.ts:23-30` with `prepare: false`, `max: 1`, `idle_timeout: 20`,
  `connect_timeout: 15`, cached on `globalThis` outside production.
- Actor binding: `src/db/session.ts` — `withActor()` sets `app.actor_id` and
  `app.actor_role` **transaction-locally** via `set_config(..., true)`.
- **No client-side data library.** No TanStack Query, SWR, Zustand, Redux, or Context
  store. Data flows through React Server Components and Server Actions only.
- 11 files carry `'use client'`; 5 modules carry `'use server'`, plus one inline
  `'use server'` inside `src/app/(admin)/admin/submissions/[id]/page.tsx`.

### Database ownership

- **`drizzle/`** owns the schema: `0000_baseline.sql` (32.7 KB),
  `0001_app_runtime_layer.sql` (44.2 KB), `0002_runtime_grants.sql` (2.0 KB), plus `meta/`.
- **`supabase/migrations/`** holds exactly one file,
  `20260819113741_remote_schema.sql`, **0 bytes and deliberately so** — its version is
  recorded in the remote `supabase_migrations.schema_migrations` table.
- **No generated Supabase types exist.** Types are inferred from the 16 Drizzle schema
  files in `src/db/schema/`. Schema-to-migration parity is therefore checked with
  `drizzle-kit check`, not with a type-generation diff.

## 7. Supabase wiring

- `src/lib/auth/supabase-server.ts:19` — SSR client with the anon key, for the auth session.
- `src/lib/auth/supabase-server.ts:42-44` — the service-role client.
  `SUPABASE_SERVICE_ROLE_KEY` appears in **exactly one other place**,
  `src/lib/env.ts:33`, which is its schema entry. No browser client exists.

## 8. Environment surface

Two validated modules, both Zod-parsed at import time:

- `src/lib/env.ts` (server; throws if imported in a browser): `DATABASE_URL`,
  `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `MAIL_FROM`,
  `MAIL_TO_GENERAL`, `MAIL_TO_PARTNERSHIP`, `MAIL_TO_HR`, `MAIL_TO_SENSITIVE`,
  `TURNSTILE_SECRET_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
  `IP_HASH_SALT` (min 32), `SUBMISSION_ENC_KEY` (64 hex chars),
  `SUBMISSION_ENC_KEY_ID` (defaults to `k1`), `CRON_SECRET` (min 16),
  `SENTRY_DSN` (optional), `NODE_ENV`.
- `src/lib/env.public.ts`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEFAULT_LOCALE`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
  `NEXT_PUBLIC_WHATSAPP_NUMBER`.
- `SKIP_ENV_VALIDATION=1` bypasses both. CI sets it for the build step.
- `.env.local` exists in the working tree and is git-ignored. **No value from it appears
  anywhere in this audit.**
- **`.env.example` does not exist.** It was tracked, then deleted in commit `9a11a5b`
  (confirmed with `git log --diff-filter=D -- .env.example`), while `src/lib/env.ts:96`
  still instructs the developer to copy it and `.gitignore` still allow-lists it.

## 9. Testing and CI

| Item | Reality |
|---|---|
| Test runner | Vitest 4.1.11, two projects: `unit` and `integration` |
| Unit tests | **0 test files** — `tests/unit/` does not exist |
| Integration tests | 2 files (`tests/integration/project.test.ts`, `tests/integration/submission.test.ts`), 27 tests, run against PGlite |
| E2E / axe / Lighthouse | **not present**, though `docs/spec/06-BUILD-PLAN.md` section 10 calls for all three |
| CI | `.github/workflows/ci.yml`, two jobs |
| `verify` job | install, typecheck, lint, lint:css, unit, integration, `drizzle-kit check`, build, then grep `.next/static` for `service_role` |
| `db-verify` job | push-to-main only; runs `npx tsx scripts/assert-rls.ts` — **that file does not exist**; `scripts/` contains only `_env.ts`, `_owner-db.ts`, `seed.ts` |

## 10. Deployment

- `vercel.json`: region `hnd1` (Tokyo, co-located with the Supabase project) and two
  crons — `/api/cron/archive-expired` hourly, `/api/cron/purge-submissions` daily.
  Two is the Vercel Hobby ceiling.
- `next.config.ts`: `reactStrictMode`, `poweredByHeader: false`,
  `typescript.ignoreBuildErrors: false`, static security headers plus a site CSP,
  `experimental.optimizePackageImports: ['lucide-react']` (**`lucide-react` is not a
  dependency**), and `experimental.serverActions.bodySizeLimit: '4.5mb'`.
- `cacheComponents` is deliberately **off**, with the reason documented in the file.

## 11. Code hygiene counters, whole of `src/`

| Check | Count |
|---|---|
| `any` / `as any` | **0** |
| `@ts-ignore` / `@ts-expect-error` | **0** |
| `eslint-disable` | **0** |
| Non-null assertions | **0** |
| Hard-coded hex colours in `.ts`/`.tsx` | **0** |
| `TODO` / `FIXME` / `HACK` | 12 — all deliberate `TODO(org)` content placeholders in `scripts/seed.ts`, plus one `PCS-XXXXXX` docstring |

## 12. Git

- Branch `chore/pre-launch-audit`; `main` untouched; working tree clean at Phase 0.
- 9 commits, Conventional Commit format throughout.
- **No `.env` file was ever committed.** The only env file in history is `.env.example`,
  added early and deleted in `9a11a5b`.

## 13. UNDETERMINED — needs confirmation

| Item | Why it could not be determined | Tracked in |
|---|---|---|
| Whether the six absent public routes are descoped or simply unbuilt | Product intent, not derivable from code | `04-OPEN-QUESTIONS.md` |
| Whether the live remote database matches `drizzle/*.sql` | No read-only session was run against the remote project | `04-OPEN-QUESTIONS.md` |
| Vercel project environment-variable parity | The deployment target is not readable from here | `04-OPEN-QUESTIONS.md` |
| Branch-protection rules on `main` | Not readable from repository contents | `04-OPEN-QUESTIONS.md` |
| Any runtime or visual behaviour | No browser automation is installed | `04-OPEN-QUESTIONS.md` |
