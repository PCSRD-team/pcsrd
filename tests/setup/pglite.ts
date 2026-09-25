import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll } from 'vitest';
import * as schema from '@/db/schema';

/**
 * Integration tests run against **real Postgres 17** compiled to WebAssembly
 * and hosted in the test process.
 *
 * This buys the thing a mock cannot: enum types, array columns, GIN indexes,
 * check constraints, foreign keys, triggers and transaction semantics all
 * behave as they will in production. What it does not reproduce is Supavisor —
 * connection pooling and `prepare: false` are only exercisable against the real
 * pooler, so the four assertions in 06-BUILD-PLAN §3 stay mandatory.
 */

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

let client: PGlite;
let testDb: TestDb;

/** Splits a Drizzle migration on its own breakpoint marker. */
function statements(sql: string): string[] {
  return sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createTestDb(): Promise<{ db: TestDb; client: PGlite }> {
  const pg = new PGlite();
  const dir = path.join(process.cwd(), 'drizzle');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = await readFile(path.join(dir, file), 'utf8');
    for (const statement of statements(sql)) {
      try {
        await pg.exec(statement);
      } catch (error) {
        throw new Error(
          `Migration ${file} failed on statement:\n${statement.slice(0, 400)}\n\n${String(error)}`,
        );
      }
    }
  }

  return { db: drizzle(pg, { schema, casing: 'snake_case' }), client: pg };
}

/**
 * One database per test **file**, not per test. Creating a PGlite instance
 * costs about a second; `vitest.config.ts` disables file parallelism so the
 * instances never contend.
 */
export function useTestDb(): () => TestDb {
  beforeAll(async () => {
    const created = await createTestDb();
    testDb = created.db;
    client = created.client;
  }, 60_000);

  afterAll(async () => {
    await client?.close();
  });

  return () => testDb;
}

/**
 * Truncates every application table between tests.
 *
 * `restart identity cascade` resets `audit_logs.id` too, so a test can assert
 * on an exact id without depending on what ran before it.
 */
export async function resetTables(db: TestDb): Promise<void> {
  await db.execute(`
    truncate table
      audit_logs, form_submissions, redirects,
      application_events, applications, application_form_fields, application_forms,
      post_media, program_media, story_media, project_media, project_partners,
      impact_metrics, posts, stories, publications, vacancies, pages,
      projects, programs, partners, people, organization_settings,
      media_assets, profiles
    restart identity cascade
  `);
}
