import { BreadcrumbJsonLd } from '@/components/seo/json-ld';
import { Breadcrumbs, type BreadcrumbItem } from '@/components/ui/breadcrumbs';
import { type Locale, localePath } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n/get-dictionary';

/**
 * The breadcrumb trail every non-home page carries.
 *
 * One call site builds both the visible `<nav>` and the `BreadcrumbList`
 * JSON-LD from the same `trail`, so the two cannot disagree. Home is always
 * first; the last entry is the current page — rendered as text with
 * `aria-current`, but still carrying its URL in the structured data.
 *
 * `trail` is locale-less: `{ label, path: '/about' }`.
 */
export type Crumb = { label: string; path: string };

export function SiteBreadcrumbs({
  locale,
  dict,
  trail,
  className,
}: {
  locale: Locale;
  dict: Dictionary;
  trail: Crumb[];
  className?: string;
}) {
  const all: Crumb[] = [{ label: dict.nav.home, path: '/' }, ...trail];
  const last = all.length - 1;

  const items: BreadcrumbItem[] = all.map((crumb, index) => ({
    label: crumb.label,
    href: index === last ? undefined : localePath(locale, crumb.path),
  }));
  const jsonLdItems = all.map((crumb) => ({ name: crumb.label, url: localePath(locale, crumb.path) }));

  return (
    <Breadcrumbs
      items={items}
      label={dict.a11y.breadcrumb}
      jsonLd={<BreadcrumbJsonLd items={jsonLdItems} />}
      className={className}
    />
  );
}
