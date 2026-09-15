import type { UserRole } from '@/db/schema/enums';

/**
 * Who is asking.
 *
 * A service takes an `Actor` rather than reading a session, because reading a
 * session means `cookies()`, and `cookies()` throws outside a Next request.
 * Passing the actor in is what makes the same service callable from a Server
 * Action, a route handler, a cron job, a seed script and a test.
 */
export type Actor = {
  id: string;
  fullName?: string | null;
  role: UserRole;
  /** Not derived from `role` — granted per person by policy (02-API §7). */
  canViewSensitive: boolean;
  isActive: boolean;
};

/** The actor for work with no human behind it: cron jobs, seeds, migrations. */
export const SYSTEM_ACTOR: Actor = {
  id: '00000000-0000-0000-0000-000000000000',
  role: 'admin',
  canViewSensitive: false,
  isActive: true,
};

export const isSystem = (actor: Actor) => actor.id === SYSTEM_ACTOR.id;
