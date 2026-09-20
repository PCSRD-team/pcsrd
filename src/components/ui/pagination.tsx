import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Icon } from './icon';
import { paginationModel } from './pagination-model';

/**
 * Windowed pagination.
 *
 * `<nav aria-label>` with a list of links; the current page is
 * `aria-current="page"` and rendered as text, not a link to itself.
 * Previous/next carry `rel="prev"`/`rel="next"`. The arrows are directional
 * and flip in RTL; the labels are the caller's.
 *
 * Every target is a real link with a real `href`, so the control works with
 * JavaScript off and every page is crawlable.
 */

const styles = {
  list: 'flex flex-wrap items-center gap-2',
  link: 'inline-flex min-h-target min-w-target items-center justify-center gap-1 px-3 font-mono text-caption no-underline motion-standard transition-colors',
  page: 'rule-edge bg-paper text-ink hover:bg-paper-alt hover:text-ink',
  current: 'border border-ink bg-ink text-paper',
  arrow: 'rule-edge bg-paper text-ink hover:bg-paper-alt hover:text-ink',
  /** No previous/next page: dimmed, un-pressable, and the cursor says so. */
  arrowDisabled: 'rule-edge cursor-not-allowed bg-paper-alt text-ink-55',
  gap: 'inline-flex min-h-target min-w-6 items-center justify-center font-mono text-caption text-mono-muted',
};

export function Pagination({
  page,
  totalPages,
  hrefFor,
  label,
  previousLabel,
  nextLabel,
  pageLabel,
  className,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  /** The `<nav>` name — "Pagination" / "ترقيم الصفحات". */
  label: string;
  previousLabel: string;
  nextLabel: string;
  /** Accessible name for a numbered link — `(n) => \`Page ${n}\``. */
  pageLabel?: (page: number) => string;
  className?: string;
}) {
  const model = paginationModel(page, totalPages, hrefFor);
  if (model.empty) return null;

  return (
    <nav aria-label={label} className={cn('mbs-8', className)}>
      <ul className={styles.list}>
        <li>
          {model.previous ? (
            <Link
              href={model.previous.href}
              rel="prev"
              aria-label={previousLabel}
              className={cn(styles.link, styles.arrow)}
            >
              <Icon name="chevron" size={16} className="-scale-x-100 rtl:scale-x-100" />
              <span className="sr-only sm:not-sr-only">{previousLabel}</span>
            </Link>
          ) : (
            <span aria-disabled="true" className={cn(styles.link, styles.arrowDisabled)}>
              <Icon name="chevron" size={16} className="-scale-x-100 rtl:scale-x-100" />
              <span className="sr-only sm:not-sr-only">{previousLabel}</span>
            </span>
          )}
        </li>

        {model.items.map((item) =>
          item.kind === 'gap' ? (
            <li key={item.key} aria-hidden="true" className={styles.gap}>
              …
            </li>
          ) : (
            <li key={item.page}>
              {item.current ? (
                <span aria-current="page" className={cn(styles.link, styles.current)}>
                  {item.page}
                </span>
              ) : (
                <Link
                  href={item.href}
                  aria-label={pageLabel?.(item.page)}
                  className={cn(styles.link, styles.page)}
                >
                  {item.page}
                </Link>
              )}
            </li>
          ),
        )}

        <li>
          {model.next ? (
            <Link
              href={model.next.href}
              rel="next"
              aria-label={nextLabel}
              className={cn(styles.link, styles.arrow)}
            >
              <span className="sr-only sm:not-sr-only">{nextLabel}</span>
              <Icon name="chevron" size={16} />
            </Link>
          ) : (
            <span aria-disabled="true" className={cn(styles.link, styles.arrowDisabled)}>
              <span className="sr-only sm:not-sr-only">{nextLabel}</span>
              <Icon name="chevron" size={16} />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
