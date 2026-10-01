'use client';

import { useMemo, useState } from 'react';

/**
 * A list of editable rows with a stable React key per row.
 *
 * Keying rows by their index is what the organisation editors did, and it
 * breaks the moment a row is removed from the middle: React keeps the DOM of
 * index 2 for what is now a different row, so focus, a half-typed IME
 * composition or a screen reader's position lands on the wrong item. Each row
 * here carries a `uid` minted once, when it enters the list.
 *
 * The uid is never rendered into markup, only used as a key, so a server and a
 * client minting different values cannot cause a hydration mismatch.
 */

let counter = 0;

function keyed<T>(value: T): { uid: string; value: T } {
  counter += 1;
  return { uid: `row-${counter}`, value };
}

export function useKeyedRows<T>(initial: T[]) {
  const [rows, setRows] = useState(() => initial.map(keyed));
  const items = useMemo(() => rows.map((row) => row.value), [rows]);

  return {
    rows,
    items,
    add: (value: T) => setRows((current) => [...current, keyed(value)]),
    remove: (uid: string) => setRows((current) => current.filter((row) => row.uid !== uid)),
    update: (uid: string, next: (value: T) => T) =>
      setRows((current) =>
        current.map((row) => (row.uid === uid ? { ...row, value: next(row.value) } : row)),
      ),
  };
}
