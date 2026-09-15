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

/** Cloudflare Turnstile. One of the two third-party origins the site talks to. */
const TURNSTILE = 'https://challenges.cloudflare.com';
const SUPABASE = 'https://*.supabase.co';

/**
 * The other one: Sentry's ingest endpoint, and only when a DSN is configured.
 *
 * A DSN is `https://<key>@<host>/<project>`; the browser SDK POSTs events to
 * `https://<host>/api/<project>/envelope/`. Allowing the host origin — not
 * `*.sentry.io` — means a deployment without Sentry has a policy that names
 * no tracker at all, and a deployment with one names exactly its own ingest
 * host. The SDK itself is bundled into the app's own chunks, so `script-src`
 * does not change; this is a `connect-src` entry and nothing else.
 *
 * `NEXT_PUBLIC_SENTRY_DSN` is the browser's DSN, which is the one the policy
 * has to admit. It is read here, at module scope, because both policies are
 * built at different times — the site one at `next build`, the admin one per
 * request in `src/proxy.ts` — and Next inlines `NEXT_PUBLIC_*` into both.
 * Tests pass an explicit value instead.
 */
export function sentryIngestOrigin(dsn: string | undefined | null): string | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    if (url.protocol !== 'https:' || !url.hostname) return null;
    return url.origin;
  } catch {
    return null;
  }
}

const SENTRY = sentryIngestOrigin(process.env.NEXT_PUBLIC_SENTRY_DSN);

const sentryConnect = (origin: string | null) => (origin ? ` ${origin}` : '');

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
export function buildSiteCsp(isDev: boolean, sentryOrigin: string | null = SENTRY): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'${devScript(isDev)} ${TURNSTILE}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${SUPABASE}`,
    `font-src 'self'`,
    `connect-src 'self'${devConnect(isDev)} ${SUPABASE} ${TURNSTILE}${sentryConnect(sentryOrigin)}`,
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
export function buildAdminCsp(
  nonce: string,
  isDev: boolean,
  sentryOrigin: string | null = SENTRY,
): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devScript(isDev)}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${SUPABASE}`,
    `font-src 'self'`,
    `connect-src 'self'${devConnect(isDev)} ${SUPABASE}${sentryConnect(sentryOrigin)}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    ...upgrade(isDev),
  ].join('; ');
}
