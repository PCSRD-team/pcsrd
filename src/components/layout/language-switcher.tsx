'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { type Locale, otherLocale } from '@/lib/i18n/config';

/**
 * **A client component, deliberately.**
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
export function LanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const target = otherLocale(locale);

  const [, first, ...rest] = pathname.split('/');
  const withoutLocale = first === 'ar' || first === 'en' ? `/${rest.join('/')}` : pathname;
  const query = searchParams.toString();

  const href = `/${target}${withoutLocale === '/' ? '' : withoutLocale}${query ? `?${query}` : ''}`;

  return (
    <Link
      href={href}
      hrefLang={target}
      // The other locale is a different render of a page most visitors never
      // open; prefetching it doubles the work for no benefit.
      prefetch={false}
      className="font-mono text-caption text-ink-55 no-underline hover:text-gold-700"
    >
      {label}
    </Link>
  );
}
