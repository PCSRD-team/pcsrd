'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { readAsSelf } from '@/db/session';
import { profiles } from '@/db/schema';
import { createSupabaseServerClient } from '@/lib/auth/supabase-server';
import { getClientIp, hashIp } from '@/lib/security/ip';
import { checkRateLimit } from '@/lib/security/rate-limit';
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
    // A Server Action is a POST endpoint: it is reachable without ever
    // rendering the login page, so nothing on that page can gate it. Before
    // this, sign-in called none of `checkRateLimit`, `verifyTurnstile` or
    // `writeAudit` — unlimited password guessing against every admin account
    // of an organisation working in Gaza, leaving no trace anywhere.
    //
    // Two keys, deliberately. The address alone lets one attacker spread a
    // list across a botnet; the account alone lets one host walk the whole
    // staff list. Both are hashed, so neither the limiter's storage nor its
    // keys carry an address or an email in the clear.
    const ip = await getClientIp();
    const [byIp, byAccount] = await Promise.all([
      checkRateLimit('login', `ip:${hashIp(ip) ?? 'unknown'}`),
      checkRateLimit('login', `account:${hashIp(email.toLowerCase()) ?? 'unknown'}`),
    ]);
    if (!byIp.success || !byAccount.success) {
      return err('rate_limited', 'errors.rateLimited');
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    // One message for a wrong password and an unknown address alike. Telling
    // them apart turns the login form into a way to discover who has an
    // account at an organisation working in Gaza.
    if (error || !data.user) return err('unauthorized', 'admin.auth.invalid');

    // Both statements bind the caller's id. `profiles` is FORCE ROW LEVEL
    // SECURITY and the runtime has no BYPASSRLS, so on the bare `db` handle
    // this select was `anon`, matched neither branch of `profiles.rt_select`
    // and returned zero rows. `profile` was then `undefined`, so
    // `!profile?.isActive` was **true** — and every correct password was
    // rejected with "your account has been deactivated", which is the one
    // message guaranteed to send a real user to an administrator rather than
    // to a retry.
    //
    // `readAsSelf` binds only `app.actor_id`, never a role. Both branches the
    // policies need — `id = app.actor_id()` on select and on update — are
    // satisfied by that alone, and nothing else becomes visible.
    const profile = await readAsSelf(db, data.user.id, async (tx) => {
      const [row] = await tx
        .select({ isActive: profiles.isActive })
        .from(profiles)
        .where(eq(profiles.id, data.user.id))
        .limit(1);

      if (!row?.isActive) return row ?? null;

      await tx
        .update(profiles)
        .set({ lastLoginAt: new Date() })
        .where(eq(profiles.id, data.user.id));

      return row;
    });

    if (!profile?.isActive) {
      await supabase.auth.signOut();
      return err('forbidden', 'admin.auth.deactivated');
    }

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
