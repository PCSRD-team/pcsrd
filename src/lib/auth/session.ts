import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import type { Actor } from '@/services/_shared/actor';
import { createSupabaseServerClient } from './supabase-server';

/**
 * The signed-in profile, or null.
 *
 * Wrapped in React's `cache` so a request that checks the session in a layout,
 * a page and three actions performs **one** database read rather than five.
 *
 * `getUser()` is used rather than `getSession()`: the latter reads the cookie
 * without verifying it against the auth server, which makes it forgeable.
 */
export const getCurrentProfile = cache(async (): Promise<Actor | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile] = await db
    .select({
      id: profiles.id,
      role: profiles.role,
      canViewSensitive: profiles.canViewSensitive,
      isActive: profiles.isActive,
    })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  return profile ?? null;
});

/** Profile plus the display fields the admin chrome needs. */
export const getCurrentProfileDetail = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  return profile ?? null;
});
