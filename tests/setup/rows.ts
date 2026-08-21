/**
 * The first row of a result the test asserts must exist.
 *
 * `noUncheckedIndexedAccess` is on, so `const [row] = await db.select(...)`
 * gives `T | undefined` — correct, and in a test it is noise, because the very
 * next line asserts something about the row.
 *
 * A helper rather than `!`: the PR checklist bans non-null assertions, and this
 * gives a real message when a query that was supposed to return a row does not,
 * instead of `Cannot read properties of undefined` twenty lines away from the
 * cause.
 */
export function row1<T>(rows: readonly T[]): T {
  const row = rows[0];
  if (row === undefined) {
    throw new Error('Expected at least one row, got none. The query matched nothing.');
  }
  return row;
}

/** The row at `index`, asserted to exist. */
export function rowAt<T>(rows: readonly T[], index: number): T {
  const row = rows[index];
  if (row === undefined) {
    throw new Error(`Expected a row at index ${index}, got ${rows.length} row(s).`);
  }
  return row;
}
