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

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
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
    if (!equal(from, to)) diff[key] = { from: summarize(from), to: summarize(to) };
  }

  return diff;
}
