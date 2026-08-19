import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { serverEnv } from '@/lib/env';
import * as schema from './schema';

/**
 * The one database connection.
 *
 * Three settings are not preferences:
 *
 * - **`prepare: false`** — `DATABASE_URL` points at Supavisor in *transaction*
 *   mode (:6543), where a pooled connection is handed to a different client
 *   between statements. Named prepared statements do not survive that, and the
 *   failure is intermittent: `prepared statement "s1" already exists`, under
 *   concurrency only.
 * - **`max: 1`** — a serverless invocation handles one request. A larger pool
 *   multiplies idle connections by the number of warm lambdas and exhausts the
 *   pooler under traffic, not under test.
 * - **`casing: 'snake_case'`** — the schema is written in camelCase and the
 *   database is snake_case. Drizzle does the mapping so no column needs its
 *   name restated.
 */
function createClient() {
  return postgres(serverEnv.DATABASE_URL, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}

/**
 * Cached on `globalThis` in development. Without this, every file save creates
 * a fresh pool through HMR and the project runs out of connections within a
 * few minutes of editing.
 */
const globalForDb = globalThis as unknown as {
  __pcsrdClient?: ReturnType<typeof createClient>;
};

const client = globalForDb.__pcsrdClient ?? createClient();
if (serverEnv.NODE_ENV !== 'production') globalForDb.__pcsrdClient = client;

export const db = drizzle(client, { schema, casing: 'snake_case' });

export type Db = typeof db;
/** A transaction handle. Services take `Db | Tx` so they compose. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export { schema };
