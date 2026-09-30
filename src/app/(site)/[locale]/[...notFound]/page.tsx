import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NotFoundBody } from '@/components/layout/not-found-body';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

/**
 * Any path under a known locale that matches no other route.
 *
 * **It renders the designed 404 itself rather than calling `notFound()`.**
 * This app has several root layouts — `(site)/[locale]`, `(admin)`,
 * `(admin-auth)` — and its site root sits under a dynamic segment. That is the
 * exact configuration `not-found.md` warns about: a `notFound()` raised here
 * did not resolve to `[locale]/not-found.tsx` or to this segment's own
 * boundary, but to Next's built-in error document — `<html id="__next_error__">`
 * with no `lang`, no `dir` and no site header. WCAG 2.2 SC 3.1.1 fails at
 * Level A, and a reader who followed a dead link is left with no way back.
 * Measured on 2026-09-29 against both `next dev` and a production build: the
 * catch-all ran, the 404 body rendered, and the served document was Next's.
 *
 * Rendering here keeps the page inside `[locale]/layout.tsx`, so the language,
 * the direction and the chrome are the site's own. The HTTP status comes from
 * `src/proxy.ts`, which rewrites an unknown first segment with a 404; a deeper
 * unknown path under a real section answers 200 and carries `noindex`, the same
 * outcome Next gives a streamed not-found (docs/PROGRESS.md §5.1.2).
 *
 * An earlier attempt used `experimental.globalNotFound`. It fixed the `lang`
 * but cannot render the chrome, since that convention bypasses layouts by
 * design, and it captured `notFound()` from the detail pages too.
 *
 * No `generateStaticParams`: an empty list told Next the segment had no valid
 * paths at all and routing skipped it entirely.
 *
 * **`force-dynamic`.** Without it every junk URL a scanner tried became its
 * own ISR entry under the layout's `revalidate` — written to the cache,
 * never read again. Rendered per request instead; the proxy's rewrite still
 * sets the 404 status, because a rewrite carries its status whatever the
 * target's rendering mode.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/[...notFound]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    title: dict.states.notFoundTitle,
    robots: { index: false, follow: false },
  };
}

export default async function CatchAllNotFound({
  params,
}: PageProps<'/[locale]/[...notFound]'>) {
  const { locale } = await params;
  // An unknown locale is not this route's business — `layout.tsx` already
  // refuses it.
  if (!isLocale(locale)) notFound();
  return <NotFoundBody />;
}
