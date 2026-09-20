import type { AuditDiff } from '@/db/schema/audit';

/**
 * Field-level before/after for the audit log.
 *
 * Two properties are deliberate:
 *
 * - **Only changed fields appear.** An audit entry listing forty unchanged
 *   columns is an audit entry nobody reads.
 * - **Rich-text and long values are summarised, not stored.** A TipTap document
 *   is thousands of nodes; keeping whole copies in `audit_logs.diff` would make
 *   the table larger than the content it describes. What is recorded is that
 *   the field changed, and by how much.
 */

const MAX_SCALAR_LEN = 300;

function summarize(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return value.length > MAX_SCALAR_LEN
      ? `${value.slice(0, MAX_SCALAR_LEN)}… (${value.length} chars)`
      : value;
  }
  if (typeof value === 'object') {
    const json = JSON.stringify(value);
    if (json.length > MAX_SCALAR_LEN) {
      return `[${Array.isArray(value) ? 'array' : 'object'}, ${json.length} bytes]`;
    }
    return value;
  }
  return value;
}

/**
 * Structural equality that does not care about key order.
 *
 * `JSON.stringify(a) === JSON.stringify(b)` was the obvious version and is
 * wrong for the jsonb columns: Postgres stores a `jsonb` object with its own
 * key ordering, so a value read back and posted again unchanged serialises
 * differently from the one that was written. Anything that asks "did this
 * change?" — the audit diff, and the organisation settings' permission check —
 * would answer yes to an untouched field.
 */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => valuesEqual(item, b[index]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      // `{ note_en: null }` and `{}` describe the same stored value.
      if (left[key] === undefined && right[key] === undefined) continue;
      if (!valuesEqual(left[key] ?? null, right[key] ?? null)) return false;
    }
    return true;
  }
  return false;
}

/**
 * `ignore` exists for the columns every update touches by definition —
 * `updatedAt` and `updatedBy` change on every write and recording them would
 * add two rows of noise to every entry.
 */
export function computeDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
  ignore: readonly string[] = ['updatedAt', 'updatedBy', 'createdAt', 'createdBy'],
): AuditDiff {
  const diff: AuditDiff = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after)]);

  for (const key of keys) {
    if (ignore.includes(key)) continue;
    const from = before?.[key];
    const to = after[key];
    // A create has no `before`, so a field absent from `after` is not a change.
    if (before === null && to === undefined) continue;
    if (!valuesEqual(from, to)) diff[key] = { from: summarize(from), to: summarize(to) };
  }

  return diff;
}
