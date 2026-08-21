import { notFound } from '@/lib/errors';

/**
 * The single row a statement was expected to return.
 *
 * `noUncheckedIndexedAccess` is on, and enabling it surfaced 33 places in
 * `src/` where a `.returning()` result was destructured and dereferenced
 * without a check. Thirty of them are the same shape:
 *
 *   const [row] = await tx.update(...).set(...).returning();
 *   await writeAudit(tx, actor, { entityId: row.id, diff: computeDiff(existing, row) });
 *
 * That is not a theoretical narrowing complaint. The runtime connects as
 * `app_runtime` under `FORCE ROW LEVEL SECURITY`, so an `UPDATE ... RETURNING`
 * whose row the policy filters out returns **zero rows rather than raising**.
 * Every one of those sites then dereferenced `undefined` and produced a generic
 * `errors.unexpected` — where the design intends a refusal the user can act on.
 * The `computeDiff` calls were worse: they would have written a corrupt audit
 * diff for a change that never happened.
 *
 * `notFound` rather than `forbidden`, deliberately. From here the two are
 * indistinguishable and they are *meant* to be: a policy that refused a row and
 * a row that does not exist look identical on purpose, because telling them
 * apart is how an unauthorised caller enumerates what exists. The `entity` goes
 * to `meta` for the log, never to the reader.
 *
 * Use it wherever a statement must have matched exactly one row. Do not use it
 * to paper over a query that legitimately returns none — that is what an empty
 * array is for.
 */
export function one<T>(rows: readonly T[], entity: string): T {
  const row = rows[0];
  if (row === undefined) throw notFound(entity);
  return row;
}
