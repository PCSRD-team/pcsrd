import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Data table.
 *
 * Ruled, not boxed: a 2px ink rule opens the table, the header row sits on
 * the alternate paper, rows are separated by the hairline. The wrapper
 * scrolls on the inline axis so a wide table never widens the page.
 *
 * `numeric` columns are mono, `dir="ltr"` and no-wrap. The admin is
 * unconditionally RTL, so a reference, a slug, a date or a phone number in a
 * cell is reordered by the bidi algorithm without it: `PCS-2026-0041.`
 * renders as `.PCS-2026-0041`. `dir` on the cell is sufficient isolation —
 * the UA stylesheet applies `unicode-bidi: isolate` to `[dir]`.
 *
 * `caption` is required. It is the table's accessible name; pass
 * `captionHidden` when a visible heading already names it.
 */

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Mono, LTR and narrow — dates, counts, references. */
  numeric?: boolean;
  /** Inline alignment. Numeric columns default to `end`. */
  align?: 'start' | 'end';
  /** Scope the header to the row (`th scope="row"`) — the record's name. */
  rowHeader?: boolean;
  headerClassName?: string;
  cellClassName?: string;
};

const styles = {
  scroller: 'w-full overflow-x-auto rule-section',
  table: 'w-full border-collapse text-small text-ink',
  caption: 'pbe-3 text-start text-caption text-ink-55',
  headRow: 'border-be border-rule bg-paper-alt',
  th: 'eyebrow p-3 align-bottom whitespace-nowrap',
  row: 'border-be border-hairline align-top transition-colors hover:bg-paper-alt/60',
  td: 'p-3 align-top',
  numeric: 'font-mono text-caption whitespace-nowrap tabular-nums',
  align: {
    start: 'text-start',
    end: 'text-end',
  },
  empty: 'rule-edge bg-paper-alt p-10 text-center text-small text-ink-55',
};

/** Numeric columns align to the inline end unless told otherwise. */
function alignOf<T>(column: Column<T>): string {
  const align = column.align ?? (column.numeric ? 'end' : 'start');
  return styles.align[align];
}

/**
 * The row-actions column.
 *
 * A column of buttons has no header worth reading — "Actions" above a row of
 * "Edit / Publish / Delete" is noise on screen — but a `<th>` that is empty
 * leaves a screen-reader user hearing the cell's *column* as blank while
 * navigating a grid. So the header is rendered and visually hidden, which is
 * the only combination that satisfies both. The label is a prop: the kit
 * carries no copy of its own.
 *
 * Paired, not independent: `actions` without `actionsLabel` is the unlabelled
 * column this exists to prevent, so the type refuses it.
 */
type RowActionsSlot<T> =
  | { actions?: undefined; actionsLabel?: undefined }
  | { actions: (row: T) => ReactNode; actionsLabel: string };

export function Table<T extends { id: string | number }>({
  caption,
  captionHidden,
  rows,
  columns,
  empty,
  rowHref,
  rowKey = (row) => row.id,
  actions,
  actionsLabel,
  className,
}: {
  caption: string;
  captionHidden?: boolean;
  rows: T[];
  columns: Column<T>[];
  /** Rendered instead of the table when there are no rows: a string or an `EmptyState`. */
  empty: ReactNode;
  /** The first cell carries the row link, so the whole row is not a link. */
  rowHref?: (row: T) => string;
  rowKey?: (row: T) => string | number;
  className?: string;
} & RowActionsSlot<T>) {
  if (rows.length === 0) {
    return typeof empty === 'string' ? (
      <div className={styles.empty} role="status">
        {empty}
      </div>
    ) : (
      <>{empty}</>
    );
  }

  return (
    <div className={cn(styles.scroller, className)}>
      <table className={styles.table}>
        <caption className={cn(styles.caption, captionHidden && 'sr-only')}>{caption}</caption>
        <thead>
          <tr className={styles.headRow}>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(styles.th, alignOf(column), column.headerClassName)}
              >
                {column.header}
              </th>
            ))}
            {actions ? (
              <th scope="col" className={cn(styles.th, styles.align.start)}>
                <span className="sr-only">{actionsLabel}</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={styles.row}>
              {columns.map((column, index) => {
                const Cell = column.rowHeader ? 'th' : 'td';
                const content =
                  index === 0 && rowHref ? (
                    <Link href={rowHref(row)} className="text-ink hover:text-gold-700">
                      {column.cell(row)}
                    </Link>
                  ) : (
                    column.cell(row)
                  );
                return (
                  <Cell
                    key={column.key}
                    scope={column.rowHeader ? 'row' : undefined}
                    dir={column.numeric ? 'ltr' : undefined}
                    className={cn(
                      styles.td,
                      column.numeric && styles.numeric,
                      alignOf(column),
                      column.rowHeader && 'font-medium',
                      column.cellClassName,
                    )}
                  >
                    {content}
                  </Cell>
                );
              })}
              {actions ? (
                <td className={cn(styles.td, styles.align.start)}>{actions(row)}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A wrapper for a hand-written `<table>` that still needs the scroller and
 * the rule: use it when the columns are not a flat `Column<T>[]` (row
 * groups, merged cells, footers).
 */
export function TableScroller({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(styles.scroller, className)}>{children}</div>;
}

/** A formatted date in a cell, isolated LTR with a machine-readable value. */
export function TimeCell({ dateTime, children }: { dateTime: string; children: ReactNode }) {
  return (
    <time dateTime={dateTime} dir="ltr" className="font-mono text-caption whitespace-nowrap">
      {children}
    </time>
  );
}
