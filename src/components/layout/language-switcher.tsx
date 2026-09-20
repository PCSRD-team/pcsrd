'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LinkPendingMark } from '@/components/ui/link-pending';
import { type Locale, otherLocale, splitLocalePath } from '@/lib/i18n/config';
import { cn } from '@/lib/utils';

/**
 * **A client component, deliberately** (03-FRONTEND §4 allow-list).
 *
 * The switcher has to preserve the reader's current path *and* their query —
 * a funder who has filtered the project list to Rafah and 2025 must not lose
 * that by reading the page in English. The only server-side way to know the
 * current URL is `headers()`, and reading it in the layout would opt the entire
 * `(site)` subtree out of static generation for one string.
 *
 * So: `usePathname` and `useSearchParams`, and everything else in the chrome
 * stays a Server Component.
 */
export function LanguageSwitcher({ locale, label, className }: { locale: Locale; label: string; className?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const target = otherLocale(locale);

  // `splitLocalePath` rather than a comparison against the two locale codes:
  // the prefix it strips is whatever is in `LOCALES`.
  const withoutLocale = splitLocalePath(pathname)?.rest ?? pathname;
  const query = searchParams.toString();

  const href = `/${target}${withoutLocale === '/' ? '' : withoutLocale}${query ? `?${query}` : ''}`;

  return (
    <Link
      href={href}
      hrefLang={target}
      lang={target}
      // The other locale is a different render of a page most visitors never
      // open; prefetching it doubles the work for no benefit.
      prefetch={false}
      // `min-h-target` keeps the 44px target the design system asks for; the
      // 1px paper edge is the only decoration — square, like every control.
      className={cn(
        'motion-standard relative inline-flex min-h-target items-center border border-paper/40 px-3 font-mono text-caption font-medium text-paper no-underline transition-colors hover:border-gold-600 hover:text-gold-050',
        className,
      )}
    >
      {label}
      <LinkPendingMark />
    </Link>
  );
}
