import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n/config';

/**
 * Catches any path under a known locale that matches no other route, so the
 * 404 renders **inside** `[locale]/layout.tsx`.
 *
 * Without it, `/ar/a-stale-link` matched nothing at all and got Next's
 * built-in 404: a bare `<html>` with no `lang` — WCAG 2.2 SC 3.1.1 at Level A
 * — and no way back into the site for a reader who followed a dead link from
 * an old newsletter.
 *
 * Here the locale is a real segment, so `[locale]/layout.tsx` supplies the
 * chrome, the language and the direction, and `[locale]/not-found.tsx`
 * supplies the designed panel.
 *
 * **This covers every reader-facing URL**, because `src/proxy.ts` redirects
 * any path without a locale prefix to one that has it: `/nonsense` becomes
 * `/ar/nonsense` and lands here. What the proxy excludes — `/api`, `/admin`,
 * `/_next`, `feed.xml` — is not a page a reader arrives at, and a bare 404
 * there is correct.
 *
 * An earlier attempt used `experimental.globalNotFound` with an
 * `app/global-not-found.tsx`. It fixed the `lang` but could not render the
 * chrome, since that convention bypasses layouts by design; worse, a
 * `notFound()` raised from *this* segment resolved to the global page rather
 * than to `[locale]/not-found.tsx`, so the flag actively prevented the better
 * answer. Removed in favour of this route.
 *
 * No `generateStaticParams`: an empty list told Next the segment had no valid
 * paths at all and routing skipped it entirely.
 */
export default async function CatchAllNotFound({
  params,
}: PageProps<'/[locale]/[...notFound]'>) {
  const { locale } = await params;
  // An unknown locale is not this route's business — `layout.tsx` already
  // refuses it. Reading the segment keeps the signature honest about being
  // dynamic.
  if (!isLocale(locale)) notFound();
  notFound();
}
