import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, isLocale, negotiateLocale } from '@/lib/i18n/config';

/**
 * `proxy.ts`, not `middleware.ts` — the file was renamed in Next 16 and the old
 * name no longer runs. It is Node-runtime only; `export const runtime` throws.
 *
 * Two jobs, and deliberately no third:
 *
 * 1. Redirect a path with no locale prefix to one that has it.
 * 2. Attach a per-request CSP nonce **to `/admin` only**.
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

function buildAdminCsp(nonce: string): string {
  return [
    `default-src 'self'`,
    // 'strict-dynamic' lets Next's bootstrap load its own chunks without each
    // one needing the nonce, while still refusing anything a page injects.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Next inlines critical CSS; there is no nonce-based alternative for it.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://*.supabase.co`,
    `font-src 'self'`,
    `connect-src 'self' https://*.supabase.co`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    const nonce = crypto.randomUUID().replaceAll('-', '');
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', buildAdminCsp(nonce));
    return response;
  }

  if (EXCLUDED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next();
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
