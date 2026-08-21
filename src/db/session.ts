import { sql } from 'drizzle-orm';
import type { Db, Tx } from './index';
import type { UserRole } from './schema/enums';

/**
 * Binds an actor to a database transaction.
 *
 * The runtime connects as `app_runtime`, which has **no** `BYPASSRLS`, and all
 * twenty-one tables are `FORCE ROW LEVEL SECURITY`. The policies read three
 * session settings — `app.actor_id`, `app.actor_role` and
 * `app.can_view_sensitive` — through the `app.*` gate functions, so a statement
 * issued without them runs as `anon` and sees published content only.
 *
 * All three must be set here. `app.can_view_sensitive()` is
 * `is_staff() AND current_setting('app.can_view_sensitive') = 'true'`, and
 * `current_setting(..., true)` returns NULL rather than raising when the setting
 * is absent — so omitting it does not fail loudly, it silently evaluates to
 * false and the sensitive-submission policy filters every row away. That is a
 * confidential complaints inbox that reports itself as empty.
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
export type ActorContext = {
  id: string;
  role: UserRole;
  /** Not derived from `role` — granted per person by policy (02-API §7). */
  canViewSensitive: boolean;
};

export async function withActor<T>(
  db: Db,
  actor: ActorContext,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      select set_config('app.actor_id', ${actor.id}, true),
             set_config('app.actor_role', ${actor.role}, true),
             set_config('app.can_view_sensitive', ${actor.canViewSensitive ? 'true' : 'false'}, true)
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
 * Reads on behalf of a user whose role is not known yet.
 *
 * This exists for exactly one caller: the identity bootstrap. Resolving a
 * profile is a chicken-and-egg problem — `withActor` wants a role, and the role
 * is the thing being read. Binding a guessed role here would be a privilege
 * escalation with a plausible excuse, so this binds **only** `app.actor_id` and
 * leaves the role at its `anon` default.
 *
 * That is sufficient because `profiles.rt_select` is
 * `app.is_staff() OR id = app.actor_id()` — the second branch exists for this
 * case. It is also safe: with the role unset, `app.is_staff()` is false, so the
 * statement can see the caller's own row and nothing else. Verified against a
 * real Postgres as `app_runtime`: one row returned, zero other profiles visible.
 */
export async function readAsSelf<T>(
  db: Db,
  userId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.actor_id', ${userId}, true)`);
    return fn(tx);
  });
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
