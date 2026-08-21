import './_env';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';

/**
 * An owner connection, for scripts only.
 *
 * `src/db/index.ts` connects as `app_runtime`, which is correct for the
 * application: no `BYPASSRLS`, subject to all 85 policies. A seed is a
 * different kind of work — it creates the `organization_settings` singleton,
 * which the runtime role deliberately has no `INSERT` grant for, because that
 * row is a schema fixture rather than something the site creates.
 *
 * Using `DIRECT_URL` here is the honest expression of that: seeding is closer
 * to a migration than to a request.
 */
const client = postgres(process.env.DIRECT_URL!, {
  prepare: false,
  max: 1,
  connect_timeout: 20,
});

export const ownerDb = drizzle(client, { schema, casing: 'snake_case' });
export const closeOwnerDb = () => client.end({ timeout: 5 });
