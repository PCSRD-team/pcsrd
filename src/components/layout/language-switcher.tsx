'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { type Locale, otherLocale } from '@/lib/i18n/config';
import { cn } from '@/lib/utils';

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
export function LanguageSwitcher({ locale, label, className }: { locale: Locale; label: string; className?: string }) {
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
      // `inline-flex` + `min-h-11` rather than padding alone: WCAG 2.2 SC 2.5.8
      // wants 24x24 and the design system asks for 44px, and this link sits
      // `gap-4` from its neighbour — under the 24px offset that would let the
      // spacing exception rescue a smaller target. It was ~23.2px.
      className={cn(
        'inline-flex min-h-11 items-center font-mono text-caption text-ink-55 no-underline hover:text-gold-700',
        className,
      )}
    >
      {label}
    </Link>
  );
}
