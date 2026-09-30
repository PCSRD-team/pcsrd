# PCSRD website

The public website and content admin of PCSRD. Arabic is the default locale and
is drawn right-to-left first; English is the second locale.

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 · Supabase
Postgres with row-level security · Drizzle · Resend · Upstash · Vercel.

**Before changing anything, read [`CLAUDE.md`](CLAUDE.md).** It holds the
working conventions: the three code layers, the database authorisation layer,
where Next 16 differs from the spec, and the deliberate deviations. The running
state of the project is in [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Getting started

```sh
npm install
cp .env.example .env.local          # PowerShell: Copy-Item .env.example .env.local
npm run dev
```

Fill `.env.local` with real values; `.env.example` documents each one. Never
commit secrets. `src/lib/env.public.ts` validates the `NEXT_PUBLIC_*` values
and `src/lib/env.ts` the server-only ones, at module load.

Open <http://localhost:3000/ar> or <http://localhost:3000/en>. The admin is at
`/admin` and needs an invited account.

## Checks

```sh
npm run typecheck        # next typegen + tsc
npm run lint             # ESLint, including the physical-CSS-property rule
npm run lint:css         # Stylelint
npm run test:unit        # pure functions
npm run test:int         # services against PGlite (in-process Postgres)
npm run test:e2e         # Playwright; see tests/e2e/README.md
npm run build
```

## Database

`drizzle/` owns every application table, function, trigger and policy;
`supabase/migrations/` owns storage buckets, their policies and the auth
trigger. Nothing in one touches the other.

The live database was built from hand-written DDL and has no Drizzle journal,
so **do not run `npm run db:migrate` against it**. Apply pending migrations with:

```sh
npx tsx scripts/apply-pending-migrations.ts           # dry run
npx tsx scripts/apply-pending-migrations.ts --apply   # uses DIRECT_URL (:5432)
npx tsx scripts/assert-rls.ts                         # the authorisation layer is intact
```

`DATABASE_URL` connects as `app_runtime` (subject to RLS) through the pooler on
`:6543`; `DIRECT_URL` connects as the owner on `:5432` and is for DDL only.

## Deployment and operations

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md): first deployment, environment
  variables, the launch checklist.
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md): backups, restores, key rotation,
  incidents.
