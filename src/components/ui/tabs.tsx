import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Tabs as links.
 *
 * Each tab is a real `<a href>` to a route or a query, so the control works
 * with JavaScript off, every panel is a crawlable URL, and the browser's
 * back button does what the reader expects. Because they are links, the
 * markup is a `<nav aria-label>` with `aria-current="page"` — not the ARIA
 * `tablist` pattern, which promises keyboard behaviour (arrow keys, a single
 * tab stop) that links do not have.
 *
 * The selected tab carries the 2px ink rule along its block-end edge; the
 * row is closed by the 1px rule. Counts are mono.
 */

export type TabItem = {
  label: string;
  href: string;
  current: boolean;
  /** A facet count, rendered in mono after the label. */
  count?: number | string | null;
};

const styles = {
  nav: 'scroll-fade overflow-x-auto',
  list: 'flex min-w-max gap-1 border-be border-rule',
  tab: 'inline-flex min-h-target items-center gap-2 border-be-2 border-transparent px-4 py-2 text-small no-underline motion-standard transition-colors',
  idle: 'text-ink-70 hover:border-rule-strong hover:text-ink',
  current: 'border-ink font-medium text-ink',
  count: 'font-mono text-eyebrow text-mono-muted',
};

export function Tabs({
  items,
  label,
  className,
}: {
  items: TabItem[];
  /** The `<nav>` name — what the tabs switch between. */
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn(styles.nav, className)}>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.href} className="-mbe-px">
            <Link
              href={item.href}
              aria-current={item.current ? 'page' : undefined}
              className={cn(styles.tab, item.current ? styles.current : styles.idle)}
            >
              {item.label}
              {item.count !== undefined && item.count !== null ? (
                <span className={styles.count} dir="ltr">
                  {item.count}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
