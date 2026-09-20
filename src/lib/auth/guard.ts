import { redirect } from 'next/navigation';
import { forbidden, unauthorized } from '@/lib/errors';
import type { Actor } from '@/services/_shared/actor';
import { getCurrentProfile } from './session';

/**
 * Guards for the admin surface.
 *
 * Every admin Server Action calls one of these as its **first statement**. A
 * guard in the page but not in the action is an open endpoint: the action is
 * reachable by POST without ever rendering the page.
 *
 * Page-level guards redirect, because a person who lands on a page they cannot
 * see should be sent somewhere useful. Action-level guards **throw**, because a
 * redirect from inside a form submission is indistinguishable from success.
 */

/** For layouts and pages. Redirects. */
export async function requireAuth(): Promise<Actor> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.isActive) redirect('/admin/login');
  return profile;
}

/**
 * There is deliberately no `requireRole(roles)` here.
 *
 * One existed and had no caller. Role is not what decides an admin action in
 * this system — `src/services/_shared/permissions.ts` maps a capability to the
 * roles that hold it, and the service checks the capability. A second,
 * page-level list of roles would be the same rule written twice in two places
 * that drift, and the drifting copy is the one that grants too much.
 */

/** Confidential complaints. Deliberately not derived from role. */
export async function requireSensitiveAccess(): Promise<Actor> {
  const profile = await requireAuth();
  if (!profile.canViewSensitive) redirect('/admin?error=forbidden');
  return profile;
}

/** For Server Actions and Route Handlers. Throws an `AppError`. */
export async function requireActor(): Promise<Actor> {
  const profile = await getCurrentProfile();
  if (!profile) throw unauthorized();
  if (!profile.isActive) throw forbidden('account deactivated');
  return profile;
}
