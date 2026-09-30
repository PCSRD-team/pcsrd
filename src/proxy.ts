import { createServerClient, type CookieOptions } from '@supabase/ssr';
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
import { SESSION_COOKIE_OPTIONS } from '@/lib/auth/cookie-options';
import { publicEnv } from '@/lib/env.public';
import { buildAdminCsp } from '@/lib/security/csp';
import { isSiteSection } from '@/lib/site-sections';

/**
 * `proxy.ts`, not `middleware.ts` — the file was renamed in Next 16 and the old
 * name no longer runs. It is Node-runtime only; `export const runtime` throws.
 *
 * Three jobs, and deliberately no fourth:
 *
 * 1. On `/admin` only: attach a per-request CSP nonce and refresh the Supabase
 *    session cookies (see `adminResponse`).
 * 2. Apply the CMS-managed redirects table to site paths.
 * 3. Redirect a path with no locale prefix to one that has it.
 *
 * The admin session is refreshed here but **not authorised** here. Deciding
 * who may see a page means a database round trip for the profile;
 * `(admin)/layout.tsx` does it once, and every admin action guards again.
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
  '/manifest.webmanifest',
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

/**
 * A stored destination is followed only if it is an absolute `https://` URL or
 * a path that stays on this origin.
 *
 * `//evil.com` is protocol-relative, and browsers read `/\evil.com` the same
 * way — the WHATWG parser treats `\` as `/` in special schemes — so both are
 * refused outright, as is any control character a parser might strip. The
 * path is then resolved against the request URL and must keep its origin,
 * which catches any spelling the two string checks did not anticipate.
 */
export function isSafeDestination(destination: string, base: string | URL): boolean {
  if (destination.includes('\\') || /[\u0000-\u001f\u007f]/.test(destination)) return false;
  try {
    if (destination.startsWith('/')) {
      if (destination.startsWith('//')) return false;
      return new URL(destination, base).origin === new URL(base).origin;
    }
    return new URL(destination).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * The `/admin` branch: a CSP nonce, and a refreshed Supabase session.
 *
 * **The nonce.** Next reads it from the *request's* `Content-Security-Policy`
 * header (`app-render.js`, `getScriptNonceFromHeader`) and stamps it on its
 * own bootstrap scripts. Setting the policy on the response alone leaves those
 * scripts un-nonced, and `'strict-dynamic'` then blocks every one of them — or,
 * if the site policy also applies, the page silently falls back to that. So the
 * policy goes on both: the request for Next, the response for the browser.
 *
 * **The session.** The access token lives an hour. A Server Component cannot
 * write cookies, so a token rotated during a render is thrown away and the
 * next request presents a refresh token that has already been spent — which
 * reads to the person as a random logout. Refreshing here, before any render,
 * is the `@supabase/ssr` pattern: rotated cookies go onto the request (so the
 * render sees the new token) and onto the response (so the browser keeps it).
 *
 * `getClaims()` rather than `getUser()`: with asymmetric signing keys it
 * verifies the JWT locally against a cached JWKS instead of calling the auth
 * server on every admin request and prefetch. It is a refresh, not a guard —
 * `(admin)/layout.tsx` and every admin action still authorise, with
 * `getUser()`, against the database.
 */
async function adminResponse(request: NextRequest): Promise<NextResponse> {
  const pending: { name: string; value: string; options: CookieOptions }[] = [];
  let pendingHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet, headers) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          pending.push(...toSet);
          pendingHeaders = headers;
        },
      },
    },
  );

  try {
    await supabase.auth.getClaims();
  } catch (error) {
    // An unreachable auth server must not take the admin down with it; the
    // layout's own check decides what the person sees.
    console.error('[proxy] session refresh failed', error);
  }

  const nonce = crypto.randomUUID().replaceAll('-', '');
  const csp = buildAdminCsp(nonce, isDev);

  // Built after the refresh, so the forwarded `cookie` header carries the
  // rotated tokens that `request.cookies.set` wrote into `request.headers`.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  for (const { name, value, options } of pending) response.cookies.set(name, value, options);
  // `Cache-Control: private, no-store` and friends when a cookie was written:
  // a response carrying one person's session must never be cached for another.
  for (const [key, value] of Object.entries(pendingHeaders)) response.headers.set(key, value);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return adminResponse(request);
  }

  if (EXCLUDED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }

  // Consulted only for site paths — the exclusions above already removed
  // assets, the API and the admin, and the matcher removed static files.
  if (request.method === 'GET' || request.method === 'HEAD') {
    const rule = matchRedirect(await redirectMap(), pathname);
    if (rule && isSafeDestination(rule.destinationPath, request.nextUrl.href)) {
      const target = rule.destinationPath.startsWith('/')
        ? new URL(rule.destinationPath + request.nextUrl.search, request.nextUrl)
        : new URL(rule.destinationPath);
      return NextResponse.redirect(target, rule.statusCode);
    }
  }

  const [, first, section] = pathname.split('/');
  if (isLocale(first)) {
    // An unknown section is a real 404. The catch-all route renders the
    // designed page inside the site layout — `notFound()` there falls through
    // to Next's bare error document in this multi-root-layout app — and this
    // rewrite to the same URL is what carries the status. See
    // `[...notFound]/page.tsx`.
    if (section && !isSiteSection(section)) {
      return NextResponse.rewrite(request.nextUrl, { status: 404 });
    }
    return NextResponse.next();
  }

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
  // not be cached by an intermediary and served to somebody else. A 307 alone
  // does not say that — `Vary` names what the answer depends on, and
  // `private, no-store` keeps a shared cache from holding it at all.
  const response = NextResponse.redirect(url, 307);
  response.headers.set('Vary', 'Accept-Language, Cookie');
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
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
