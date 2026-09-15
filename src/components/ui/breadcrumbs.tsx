import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Icon } from './icon';

/**
 * Breadcrumbs.
 *
 * `<nav aria-label>` around an ordered list; the last item is the current
 * page, rendered as text with `aria-current="page"`. The separator is a
 * directional chevron — decorative, flips in RTL.
 *
 * JSON-LD: the kit does not emit `<script>` tags (that is
 * `src/components/seo/*`, the one place `dangerouslySetInnerHTML` is
 * permitted). `toBreadcrumbList()` builds the schema.org object from the
 * same `items` so the two cannot disagree, and `jsonLd` is a slot for the
 * rendered `<BreadcrumbJsonLd>` so it lives next to the nav it describes.
 */

export type BreadcrumbItem = {
  label: string;
  /** Omit on the last item — the current page. */
  href?: string;
};

export function toBreadcrumbList(items: BreadcrumbItem[], origin: string) {
  const base = origin.replace(/\/+$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: item.href.startsWith('http') ? item.href : `${base}${item.href}` } : {}),
    })),
  } as const;
}

const styles = {
  list: 'flex flex-wrap items-center gap-x-2 gap-y-1 text-caption',
  link: 'inline-flex min-h-target items-center text-ink-55 no-underline hover:text-gold-700 hover:underline',
  current: 'inline-flex min-h-target items-center text-ink',
  separator: 'text-rule-strong',
};

export function Breadcrumbs({
  items,
  label,
  jsonLd,
  className,
}: {
  items: BreadcrumbItem[];
  /** The `<nav>` name — "Breadcrumb" / "مسار التنقل". */
  label: string;
  jsonLd?: ReactNode;
  className?: string;
}) {
  if (items.length === 0) return null;
  const last = items.length - 1;

  return (
    <nav aria-label={label} className={className}>
      {jsonLd}
      <ol className={styles.list}>
        {items.map((item, index) => (
          <li key={`${index}-${item.label}`} className="flex items-center gap-x-2">
            {index === last || !item.href ? (
              <span aria-current={index === last ? 'page' : undefined} className={styles.current}>
                {item.label}
              </span>
            ) : (
              <Link href={item.href} className={styles.link}>
                {item.label}
              </Link>
            )}
            {index < last ? (
              <span className={cn(styles.separator)} aria-hidden="true">
                <Icon name="chevron" size={16} />
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
