import { sql } from 'drizzle-orm';
import type { Db, Tx } from './index';
import type { UserRole } from './schema/enums';

/**
 * Binds an actor to a database transaction.
 *
 * The runtime connects as `app_runtime`, which has **no** `BYPASSRLS`, and all
 * twenty-one tables are `FORCE ROW LEVEL SECURITY`. The policies read two
 * session settings through `app.actor_id()` and `app.actor_role()`, so a
 * statement issued without them runs as `anon` and sees published content only.
 *
 * `set_config(..., true)` is **transaction-local**. That is the whole safety
 * property: on a pooled connection the next request gets a different actor, and
 * a session-level setting would leak one user's permissions into another user's
 * query. The `true` is not an optimisation.
 *
 * This is the second line of defence, not the first — the service layer refuses
 * the same operations before the statement is ever issued. The difference is
 * that this line also holds for a raw SQL console, a cron job or a bug.
 */
export type ActorContext = { id: string; role: UserRole };

export async function withActor<T>(
  db: Db,
  actor: ActorContext,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      select set_config('app.actor_id', ${actor.id}, true),
             set_config('app.actor_role', ${actor.role}, true)
    `);
    return fn(tx);
  });
}

/**
 * Runs a read with an actor's identity attached.
 *
 * Admin queries need this: without it `app.is_staff()` is false and a draft is
 * invisible to the person editing it. Public queries deliberately do **not**
 * use it — `anon` is the correct identity for a visitor, and the policies
 * already restrict them to `status = 'published'`.
 */
export async function readAsActor<T>(
  db: Db,
  actor: ActorContext,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return withActor(db, actor, fn);
}

/**
 * Normalises the result of `db.execute`.
 *
 * Drizzle returns the driver's native shape here, and the two drivers this
 * project uses disagree: `postgres-js` yields an array of rows, `pglite` yields
 * `{ rows }`. Destructuring one shape breaks silently on the other — and since
 * production is postgres-js and the tests are PGlite, the break lands in
 * whichever of the two you did not write the code against.
 */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}
