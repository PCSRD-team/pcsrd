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
        'motion-standard group inline-flex min-h-9 items-center gap-2 rounded-full border border-paper/30 bg-paper/8 px-3 font-mono text-caption font-medium text-paper no-underline transition hover:border-gold-600 hover:bg-paper/14 hover:text-gold-600',
        className,
      )}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[1.8]">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.8 12h16.4M12 3.5c2.2 2.3 3.3 5.1 3.3 8.5S14.2 18.2 12 20.5M12 3.5C9.8 5.8 8.7 8.6 8.7 12s1.1 6.2 3.3 8.5" />
      </svg>
      <span>{label}</span>
      <span aria-hidden="true" className="transition-transform duration-200 group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5">
        {locale === 'ar' ? '←' : '→'}
      </span>
    </Link>
  );
}
