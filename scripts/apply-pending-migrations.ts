import { config } from 'dotenv';
config({ path: '.env.local' });

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

/**
 * Applies the migrations the live database is missing — and **only** those.
 *
 * ## Why this exists instead of `npm run db:migrate`
 *
 * `drizzle.__drizzle_migrations` does not exist in the live database. The
 * schema was built from hand-written DDL and the `app` layer was designed in
 * the database, so drizzle-kit has never run against it: verified on
 * 2026-09-25, the `drizzle` schema is absent entirely while `public` already
 * carries 21 tables, 25 `app.*` functions and 85 policies.
 *
 * That means `drizzle-kit migrate` would see an empty journal, conclude that
 * nothing has been applied, and start at `0000_baseline.sql` — which creates
 * tables that already exist. It aborts on the first `CREATE TABLE`, and the
 * failure looks like a broken migration rather than a mis-detected baseline.
 *
 * The alternative to this script is to baseline the journal by hand: create
 * `drizzle.__drizzle_migrations` and insert a row per already-applied file
 * with the hash drizzle-kit computes. That is worth doing eventually — it is
 * what makes the ordinary command work again — but it is a change to the
 * migration bookkeeping, and doing it wrong silently skips a real migration.
 * Applying four known files is the smaller, reversible step.
 *
 * ## What it applies
 *
 * Only the four below, in order, each inside its own transaction. Probed
 * against the live database on 2026-09-25:
 *
 *   0002, 0003, 0004, 0005  already applied
 *   0006, 0007, 0008, 0009  pending  ← this script
 *
 * Each file is re-probed at run time rather than trusted from that list, so a
 * file someone applied by hand in between is skipped rather than replayed.
 *
 * ## Running it
 *
 *   npx tsx scripts/apply-pending-migrations.ts            # dry run, shows the plan
 *   npx tsx scripts/apply-pending-migrations.ts --apply    # actually writes
 *
 * It connects with `DIRECT_URL` (port 5432, as `postgres`), never
 * `DATABASE_URL`: this is DDL, and the pooler is not for DDL.
 */

type Pending = {
  file: string;
  /** True when the live database already has what this migration creates. */
  probe: (sql: postgres.Sql) => Promise<boolean>;
};

const MIGRATIONS: Pending[] = [
  {
    file: '0006_rate_limit_fallback.sql',
    probe: async (sql) =>
      (await sql`select to_regclass('public.rate_limit_hits') is not null as ok`)[0]?.ok === true,
  },
  {
    file: '0007_drop_unused_program_blocks.sql',
    probe: async (sql) =>
      (
        await sql`
          select count(*)::int as n from information_schema.columns
           where table_schema='public' and table_name='programs'
             and column_name in ('specific_objectives','key_interventions')`
      )[0]?.n === 0,
  },
  {
    file: '0008_application_portal.sql',
    probe: async (sql) =>
      (await sql`select to_regclass('public.application_forms') is not null as ok`)[0]?.ok === true,
  },
  {
    file: '0009_application_portal_runtime.sql',
    probe: async (sql) =>
      ((
        await sql`
          select count(*)::int as n from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
           where n.nspname='app' and p.proname='submit_application'`
      )[0]?.n ?? 0) > 0,
  },
];

/** Splits a drizzle migration on its own breakpoint marker. */
const statements = (sql: string): string[] =>
  sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);

async function main() {
  const apply = process.argv.includes('--apply');
  const url = process.env.DIRECT_URL;

  if (!url) {
    console.error('DIRECT_URL is not set. It is the :5432 connection, and DDL needs it.');
    process.exit(1);
  }
  if (!url.includes(':5432')) {
    console.error(
      `DIRECT_URL does not look like the direct connection (expected :5432).\n` +
        `Applying DDL through the :6543 pooler fails intermittently with an error\n` +
        `that does not point at the cause. Refusing.`,
    );
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false, connect_timeout: 30, max: 1 });

  try {
    const who = (await sql`select current_user as u, current_database() as d`)[0];
    console.log(`Connected to ${who?.d} as ${who?.u}\n`);

    for (const migration of MIGRATIONS) {
      const already = await migration.probe(sql);
      if (already) {
        console.log(`skip   ${migration.file}  (already applied)`);
        continue;
      }

      if (!apply) {
        console.log(`WOULD APPLY  ${migration.file}`);
        continue;
      }

      const body = await readFile(
        path.join(process.cwd(), 'drizzle', migration.file),
        'utf8',
      );

      // One transaction per file. A migration that fails half-way leaves
      // nothing behind, which is the difference between "run it again" and
      // "work out what survived".
      await sql.begin(async (tx) => {
        for (const statement of statements(body)) {
          await tx.unsafe(statement);
        }
      });

      console.log(`APPLIED      ${migration.file}`);
    }

    if (!apply) {
      console.log('\nDry run. Nothing was written. Re-run with --apply to write.');
    } else {
      console.log('\nDone. Verify with: npx tsx scripts/assert-rls.ts');
    }
  } finally {
    await sql.end({ timeout: 10 });
  }
}

main().catch((error) => {
  console.error('\nFAILED:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
