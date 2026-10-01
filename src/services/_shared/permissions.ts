import type { UserRole } from '@/db/schema/enums';
import { forbidden } from '@/lib/errors';
import type { Actor } from './actor';

/**
 * The permission matrix from 02-API §7, as data.
 *
 * Written once here rather than as an `if` in each of fifteen services. The
 * matrix is the specification; a service that needs a rule not in this table is
 * a service that has invented a rule.
 */
export const CAPABILITIES = [
  'content.read',
  'content.write',
  'content.publish',
  'content.delete',
  'org.settings',
  'org.settings.contact',
  'media.upload',
  'media.delete',
  'submissions.read',
  'submissions.handle',
  'users.manage',
  'audit.read',
  /**
   * Not a row in 02-API §7, which predates the redirects table. The sidebar
   * already lists redirects under Settings for `admin` only and the database
   * policy `redirects.rt_write` is `app.is_admin()`; this names that rule so a
   * service can assert it rather than compare a role string.
   */
  'redirects.manage',
  /**
   * The careers portal's sensitive answers — a national ID, a date of birth, a
   * scan of an ID card — on screen, in an export, or as a download. Not a row
   * in 02-API §7, which predates the portal. Admin only: a content manager
   * runs the pipeline and reads every other answer, and shortlisting does not
   * need an ID number. Every use is audited as `view_sensitive`.
   */
  'applications.sensitive',
  /**
   * Donation notices: read them, match them against the bank statement,
   * confirm or reject them, export them for the accounts. Admin and content
   * manager, like `submissions.read` — the same people who read the inbox.
   */
  'donations.manage',
  /**
   * The donate page's settings and bank accounts. Admin only: an IBAN on that
   * page decides where a donor's money goes, so changing one is the most
   * consequential edit in the admin. The database refuses it to anyone else
   * too (`donation_accounts.rt_update` is `app.is_admin()`).
   */
  'donations.settings',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const MATRIX: Record<UserRole, ReadonlySet<Capability>> = {
  admin: new Set(CAPABILITIES),
  content_manager: new Set<Capability>([
    'content.read',
    'content.write',
    'content.publish',
    'org.settings.contact',
    'media.upload',
    'media.delete',
    'submissions.read',
    'submissions.handle',
    'donations.manage',
  ]),
  editor: new Set<Capability>(['content.read', 'content.write', 'media.upload']),
};

export function can(actor: Actor, capability: Capability): boolean {
  if (!actor.isActive) return false;
  return MATRIX[actor.role].has(capability);
}

/** Throws `AppError('forbidden')` when the actor lacks the capability. */
export function assertCan(actor: Actor, capability: Capability): void {
  if (!can(actor, capability)) throw forbidden(`missing capability: ${capability}`);
}

/**
 * Confidential complaints. Deliberately **not** derived from role: an admin is
 * not automatically on the organisation's list of people permitted to read a
 * safeguarding complaint.
 */
export function assertCanViewSensitive(actor: Actor): void {
  if (!actor.isActive || !actor.canViewSensitive) {
    throw forbidden('missing sensitive-submission access');
  }
}
