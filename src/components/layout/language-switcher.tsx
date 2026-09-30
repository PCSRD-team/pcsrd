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
type SwitcherProps = { locale: Locale; label: string; className?: string };

/** The other locale's URL for `pathname`, with `query` kept when given. */
function switchHref(pathname: string, target: Locale, query: string): string {
  // `splitLocalePath` rather than a comparison against the two locale codes:
  // the prefix it strips is whatever is in `LOCALES`.
  const withoutLocale = splitLocalePath(pathname)?.rest ?? pathname;
  return `/${target}${withoutLocale === '/' ? '' : withoutLocale}${query ? `?${query}` : ''}`;
}

/**
 * The switcher with the query preserved. `useSearchParams` suspends during a
 * static render, so this sits in a `Suspense` whose fallback is
 * `LanguageSwitcherStatic` below.
 *
 * On a record page the slug differs per locale and this link keeps the
 * current one; the detail route looks the slug up in the other locale's
 * column and permanently redirects, so the link lands on the right page.
 */
export function LanguageSwitcher({ locale, label, className }: SwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <SwitcherLink
      href={switchHref(pathname, otherLocale(locale), searchParams.toString())}
      target={otherLocale(locale)}
      label={label}
      className={className}
    />
  );
}

/**
 * The same link built from the path alone — the Suspense fallback.
 *
 * The fallback used to be an empty `<span>`, and it is what the statically
 * generated HTML contains: every prerendered page shipped with no language
 * link at all until hydration, which is never for a crawler and a long time on
 * a slow connection. `usePathname` does not suspend, so this renders a real,
 * working link into the HTML; only the query string waits for the client.
 */
export function LanguageSwitcherStatic({ locale, label, className }: SwitcherProps) {
  const pathname = usePathname();
  return (
    <SwitcherLink
      href={switchHref(pathname, otherLocale(locale), '')}
      target={otherLocale(locale)}
      label={label}
      className={className}
    />
  );
}

function SwitcherLink({ href, target, label, className }: { href: string; target: Locale; label: string; className?: string }) {
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
