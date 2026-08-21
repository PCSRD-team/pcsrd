/**
 * The two Content-Security-Policies, in one place and testable.
 *
 * They used to be two literals — one in `next.config.ts`, one in `src/proxy.ts`
 * — with no way to assert anything about either. That mattered once they had to
 * differ by environment: React's development bundle calls `eval()` and
 * Turbopack's hot reload runs over a WebSocket, so a development page needs
 * `'unsafe-eval'` and `ws:` that a production page must never be served.
 *
 * `'unsafe-eval'` reaching a deployed page would undo most of what the header is
 * for, and on `(admin)` it would hollow out the nonce entirely. "It is behind an
 * `isDev` check" is an argument; a test that renders the production string and
 * asserts what is *not* in it is a guarantee. See `tests/unit/csp.test.ts`.
 *
 * `isDev` is passed in rather than read from `process.env` here, so the tests
 * can ask for both without mutating the environment.
 */

/** Cloudflare Turnstile. The only third-party origin the site talks to. */
const TURNSTILE = 'https://challenges.cloudflare.com';
const SUPABASE = 'https://*.supabase.co';

/**
 * Development-only additions, shared by both policies.
 *
 * - `'unsafe-eval'` — React's development build uses it for component stacks
 *   and the DevTools bridge. React never calls `eval()` in production.
 * - `ws:` / `wss:` — the hot-reload socket. There is none in production.
 * - `upgrade-insecure-requests` is *omitted* in development: it would rewrite
 *   the HMR socket's `ws://` to `wss://`, which nothing is listening on.
 */
const devScript = (isDev: boolean) => (isDev ? ` 'unsafe-eval'` : '');
const devConnect = (isDev: boolean) => (isDev ? ' ws: wss:' : '');
const upgrade = (isDev: boolean) => (isDev ? [] : ['upgrade-insecure-requests']);

/**
 * The public `(site)` policy — no nonce, deliberately.
 *
 * A nonce has to be read from `headers()`, which opts the whole subtree out of
 * static generation, and `(site)` is static + ISR by design
 * (`docs/spec/00-ARCHITECTURE.md` §0.5). `'unsafe-inline'` is what Next's inline
 * RSC bootstrap requires. The injection vector this would otherwise defend
 * against is already closed by the no-`dangerouslySetInnerHTML` rule and the
 * no-third-party-scripts rule.
 */
export function buildSiteCsp(isDev: boolean): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'${devScript(isDev)} ${TURNSTILE}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${SUPABASE}`,
    `font-src 'self'`,
    `connect-src 'self'${devConnect(isDev)} ${SUPABASE} ${TURNSTILE}`,
    `frame-src ${TURNSTILE}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    ...upgrade(isDev),
  ].join('; ');
}

/**
 * The `(admin)` policy — nonce-based, from `src/proxy.ts`.
 *
 * `'strict-dynamic'` lets Next's bootstrap load its own chunks without each one
 * needing the nonce, while still refusing anything a page injects. Next inlines
 * critical CSS and there is no nonce-based alternative for it, which is why
 * `style-src` still carries `'unsafe-inline'`.
 */
export function buildAdminCsp(nonce: string, isDev: boolean): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devScript(isDev)}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${SUPABASE}`,
    `font-src 'self'`,
    `connect-src 'self'${devConnect(isDev)} ${SUPABASE}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    ...upgrade(isDev),
  ].join('; ');
}
