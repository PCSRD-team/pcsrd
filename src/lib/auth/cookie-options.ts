import type { CookieOptionsWithName } from '@supabase/ssr';

/**
 * Options for the Supabase session cookies, shared by the server client and
 * the proxy's session refresh so the two can never disagree.
 *
 * `@supabase/ssr` defaults `httpOnly` to **false**, because its browser client
 * reads the session from `document.cookie`. This project has no browser client
 * — sign-in, sign-out and every session read happen on the server — so the
 * token has no business being readable by page script. With `httpOnly` an XSS
 * on an admin page can act as the user for as long as the tab is open, but it
 * cannot carry the refresh token away.
 *
 * `secure` is off in development only because `next dev` serves plain HTTP on
 * localhost, where a `Secure` cookie is silently never sent back.
 *
 * Kept out of `supabase-server.ts` because that module imports `next/headers`
 * and the server env, neither of which the proxy should load.
 */
export const SESSION_COOKIE_OPTIONS: CookieOptionsWithName = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};
