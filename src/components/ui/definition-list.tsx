import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The identity record shape, reused across the footer, `/about` and every
 * detail page. Terms are mono because they are labels, not prose.
 *
 * Items whose value is `null`, `undefined` or `''` are dropped, so a caller
 * can map straight from `organization_settings` without guarding each row —
 * an absent licence number produces no row rather than an empty one, which
 * is the honest rendering of a fact the organisation has not supplied yet.
 */

const styles = {
  layout: {
    /** Term and value side by side from `sm`. */
    grid: 'grid gap-x-8 gap-y-4 sm:grid-cols-[max-content_1fr]',
    /** Term above value, always. */
    stack: 'grid gap-y-4',
    /** Ruled rows — each pair separated by the 1px rule. */
    ruled: 'grid border-bs border-rule',
  },
  row: {
    grid: 'contents',
    stack: 'block',
    ruled: 'grid gap-x-8 gap-y-1 border-be border-rule py-3 sm:grid-cols-[max-content_1fr]',
  },
};

export type DefinitionItem = {
  term: string;
  value: ReactNode;
  /** Latin or numeric values (a licence number, a phone) should be wrapped in `Bidi` by the caller. */
};

export function DefinitionList({
  items,
  layout = 'grid',
  className,
  labelledBy,
}: {
  items: DefinitionItem[];
  layout?: keyof typeof styles.layout;
  className?: string;
  labelledBy?: string;
}) {
  const shown = items.filter(
    (item) => item.value !== null && item.value !== undefined && item.value !== '',
  );
  if (shown.length === 0) return null;

  return (
    <dl aria-labelledby={labelledBy} className={cn(styles.layout[layout], className)}>
      {shown.map((item) => (
        <div key={item.term} className={styles.row[layout]}>
          <dt className="eyebrow pbs-1">{item.term}</dt>
          <dd className="text-small text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
