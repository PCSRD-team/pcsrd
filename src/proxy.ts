import { NextResponse, type NextRequest } from 'next/server';
import { listRedirectRules, type RedirectRule } from '@/db/queries/redirects';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALES,
  isLocale,
  negotiateLocale,
  splitLocalePath,
} from '@/lib/i18n/config';
import { buildAdminCsp } from '@/lib/security/csp';

/**
 * `proxy.ts`, not `middleware.ts` — the file was renamed in Next 16 and the old
 * name no longer runs. It is Node-runtime only; `export const runtime` throws.
 *
 * Three jobs, and deliberately no fourth:
 *
 * 1. Attach a per-request CSP nonce **to `/admin` only**.
 * 2. Apply the CMS-managed redirects table to site paths.
 * 3. Redirect a path with no locale prefix to one that has it.
 *
 * The admin session is **not** checked here. The proxy runs on every request,
 * and verifying a session means a database round trip; `(admin)/layout.tsx`
 * does it once, and every admin action guards again anyway.
 *
 * Static security headers live in `next.config.ts` instead of here: they are
 * constant, so paying for them per request is waste, and config headers also
 * cover the paths this matcher excludes.
 */

/** Files and routes that must never be locale-prefixed. */
const EXCLUDED = [
  '/api',
  '/admin',
  '/_next',
  '/_vercel',
  '/feed.xml',
  '/sitemap.xml',
  '/robots.txt',
  '/favicon.ico',
  '/opensearch.xml',
];

/**
 * Built in `src/lib/security/csp.ts`, next to the site policy — see the note
 * there. This runs per request in the Node runtime, so `NODE_ENV` is whatever
 * the deployment sets, which on Vercel is always `production`.
 */
const isDev = process.env.NODE_ENV !== 'production';

/**
 * The redirects table, as a `Map` built from one cached array.
 *
 * Cost per request when the cache is warm: one `unstable_cache` read of a
 * small JSON blob (the whole table, one entry, tag `redirect:list`) plus a
 * `Map` construction over a few dozen rows and two lookups. No per-request
 * database query: the entry is dropped by the redirects action on every save
 * and otherwise lives for `DEFAULT_REVALIDATE`. The map is rebuilt from the
 * array on each request rather than memoised, because a memo keyed on nothing
 * would outlive the cache entry that invalidates it.
 *
 * A database that is unreachable must not take the site down with it, so a
 * failure here degrades to "no redirects" and is logged, not thrown.
 */
async function redirectMap(): Promise<Map<string, RedirectRule>> {
  let rules: RedirectRule[] = [];
  try {
    rules = await listRedirectRules();
  } catch (error) {
    console.error('[proxy] redirects unavailable', error);
  }
  return new Map(rules.map((rule) => [rule.sourcePath, rule]));
}

/**
 * Looks a request path up with and without its locale prefix, so a rule
 * written as `/old-page` also catches `/ar/old-page`. The destination is used
 * as stored: a bare internal path falls through to the locale redirect on the
 * next hop, which is one extra 307 on a legacy URL and zero extra logic here.
 */
function matchRedirect(map: Map<string, RedirectRule>, pathname: string): RedirectRule | undefined {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const direct = map.get(clean);
  if (direct) return direct;
  const split = splitLocalePath(clean);
  return split ? map.get(split.rest) : undefined;
}

function isSafeDestination(destination: string): boolean {
  return destination.startsWith('/') ? !destination.startsWith('//') : destination.startsWith('https://');
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    const nonce = crypto.randomUUID().replaceAll('-', '');
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', buildAdminCsp(nonce, isDev));
    return response;
  }

  if (EXCLUDED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }

  // Consulted only for site paths — the exclusions above already removed
  // assets, the API and the admin, and the matcher removed static files.
  if (request.method === 'GET' || request.method === 'HEAD') {
    const rule = matchRedirect(await redirectMap(), pathname);
    if (rule && isSafeDestination(rule.destinationPath)) {
      const target = rule.destinationPath.startsWith('/')
        ? new URL(rule.destinationPath + request.nextUrl.search, request.nextUrl)
        : new URL(rule.destinationPath);
      return NextResponse.redirect(target, rule.statusCode);
    }
  }

  const [, first] = pathname.split('/');
  if (isLocale(first)) return NextResponse.next();

  // A returning visitor's choice wins over their browser's; a first visit falls
  // back to Accept-Language, and Arabic when that says nothing useful.
  const stored = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale =
    stored && isLocale(stored)
      ? stored
      : negotiateLocale(request.headers.get('accept-language'));

  const url = request.nextUrl.clone();
  url.pathname = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;

  // 307, not 308: the locale is negotiated per visitor, so the redirect must
  // not be cached by an intermediary and served to somebody else.
  return NextResponse.redirect(url, 307);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets. Fonts and images are excluded because a
     * redirect on them would break the asset, not localise it.
     */
    '/((?!_next/static|_next/image|favicon.ico|fonts|icons|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf)$).*)',
  ],
};

export { LOCALES, DEFAULT_LOCALE };
