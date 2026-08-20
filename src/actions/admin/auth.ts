'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { createSupabaseServerClient } from '@/lib/auth/supabase-server';
import { type ActionResult, err, ok, runAction } from '@/lib/errors';

/**
 * Sign in and out.
 *
 * These are the only admin actions outside the auth guard, for the obvious
 * reason. Everything else in `src/actions/admin/` calls `requireActor()` as its
 * first statement.
 */

export type AuthResult = ActionResult<null>;

export async function signIn(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return err('validation', 'errors.validation', {
      email: email ? [] : ['errors.field.required'],
      password: password ? [] : ['errors.field.required'],
    });
  }

  const result = await runAction(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    // One message for a wrong password and an unknown address alike. Telling
    // them apart turns the login form into a way to discover who has an
    // account at an organisation working in Gaza.
    if (error || !data.user) return err('unauthorized', 'admin.auth.invalid');

    const [profile] = await db
      .select({ isActive: profiles.isActive })
      .from(profiles)
      .where(eq(profiles.id, data.user.id))
      .limit(1);

    if (!profile?.isActive) {
      await supabase.auth.signOut();
      return err('forbidden', 'admin.auth.deactivated');
    }

    await db
      .update(profiles)
      .set({ lastLoginAt: new Date() })
      .where(eq(profiles.id, data.user.id));

    return ok(null);
  });

  // `redirect` throws, so it must happen after the action body rather than
  // inside `runAction`, which would catch it as an error.
  if (result.ok) redirect('/admin');
  return result;
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}
