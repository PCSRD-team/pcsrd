import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { serverEnv } from '@/lib/env';
import { publicEnv } from '@/lib/env.public';
import { SESSION_COOKIE_OPTIONS } from './cookie-options';

/**
 * Supabase clients.
 *
 * Supabase is used for **authentication and storage only**. Data never travels
 * through PostgREST — it goes through Drizzle on the `app_runtime` connection,
 * which has no `BYPASSRLS`, so the 85 row-level policies in the database apply
 * to every query this app makes (see CLAUDE.md → "The database is smarter than
 * the spec"). Neither client below is ever used to read a table.
 */

/** Session-bound client for Server Components, Actions and Route Handlers. */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // A Server Component cannot write cookies. That is safe to swallow
          // only because `src/proxy.ts` refreshes the session on every
          // `/admin` request before any Server Component runs, so the token
          // a component sees has already been rotated and written back.
          // Server Actions and Route Handlers can write, and do.
        }
      },
    },
  });
}

/**
 * Service-role client for Storage. Never given a session and never used for
 * table reads.
 */
export function createSupabaseAdminClient() {
  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: { getAll: () => [], setAll: () => undefined },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
