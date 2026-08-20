import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { serverEnv } from '@/lib/env';
import { publicEnv } from '@/lib/env.public';

/**
 * Supabase clients.
 *
 * Supabase is used for **authentication and storage only**. Data never travels
 * through PostgREST — it goes through Drizzle on the owner connection
 * (00-ARCHITECTURE D1), which is why every application table has RLS enabled
 * with zero policies and no grants.
 */

/** Session-bound client for Server Components, Actions and Route Handlers. */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // A Server Component cannot write cookies. Refreshes still happen in
          // the proxy and in Server Actions, so swallowing this is correct
          // rather than merely convenient.
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
