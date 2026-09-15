import { eq } from 'drizzle-orm';
import type { Db } from '@/db';
import { withActor } from '@/db/session';
import { profiles } from '@/db/schema';
import type { UserRole } from '@/db/schema/enums';
import { AppError, conflict, forbidden, isAppError, notFound } from '@/lib/errors';
import type { Actor } from '../_shared/actor';
import { writeAudit } from '../_shared/audit';
import { computeDiff } from '../_shared/diff';
import { one } from '../_shared/one';
import { assertCan } from '../_shared/permissions';

/**
 * User management. `users.manage` — admin only.
 *
 * Two rules are stated here **and** in the database trigger
 * `guard_profile_privileges`: an admin may not change their own role, and the
 * last active admin may not be demoted or deactivated. The service refuses
 * first so the editor gets a field-level, translated message; the trigger
 * refuses again for a raw console or a bug, and its `PCSRD_*` prefix is mapped
 * back to the same dictionary key in `translateDbRefusal` so the two never
 * disagree in what the user sees.
 *
 * Self-deactivation is refused here only. The trigger permits it (an admin
 * locking themself out is not a privilege escalation), but from a web form it
 * is far more likely a mis-click than a decision.
 */

/**
 * The part of user creation this service cannot own.
 *
 * Creating an `auth.users` row is a Supabase Auth admin call — an HTTP request
 * with the service-role key. The profile row is then made by the
 * `handle_new_user` trigger, which is `SECURITY DEFINER`; the runtime role has
 * no `INSERT` on `profiles`, so this service could not create it even if it
 * wanted to. The port keeps the rule side (who may invite, what the default
 * privileges are, what gets audited) testable with a fake.
 */
export type AuthAdminPort = {
  /** Sends the invitation and returns the new auth user's id. */
  inviteByEmail: (email: string, fullName: string) => Promise<{ id: string }>;
};

export type InviteUserInput = {
  email: string;
  fullName: string;
  role?: UserRole;
  canViewSensitive?: boolean;
};

export type UserSummary = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  canViewSensitive: boolean;
  isActive: boolean;
};

function toSummary(row: typeof profiles.$inferSelect): UserSummary {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    canViewSensitive: row.canViewSensitive,
    isActive: row.isActive,
  };
}

/**
 * Maps the trigger's refusals onto the keys the form can render. Anything else
 * is rethrown untouched — an unknown database error is a bug, not a message.
 */
function translateDbRefusal(error: unknown): never {
  if (isAppError(error)) throw error;
  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : '';
  const text = `${message} ${cause}`;

  if (text.includes('PCSRD_LAST_ADMIN')) {
    throw conflict('errors.users.lastAdmin');
  }
  if (text.includes('may not change their own role')) {
    throw new AppError('forbidden', 'errors.users.selfRole', { cause: error });
  }
  if (text.includes('PCSRD_FORBIDDEN')) {
    throw forbidden('profile privilege change refused by the database');
  }
  throw error;
}

export async function inviteUser(
  db: Db,
  actor: Actor,
  input: InviteUserInput,
  auth: AuthAdminPort,
): Promise<UserSummary> {
  assertCan(actor, 'users.manage');

  const email = input.email.trim().toLowerCase();

  // Checked before the auth call, because a duplicate at the auth layer
  // surfaces as an opaque provider error while this one names the field.
  const [taken] = await withActor(db, actor, (tx) =>
    tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.email, email)).limit(1),
  );
  if (taken) {
    throw conflict('errors.users.emailTaken', { email: ['errors.users.emailTaken'] });
  }

  let invited: { id: string };
  try {
    invited = await auth.inviteByEmail(email, input.fullName.trim());
  } catch (error) {
    throw new AppError('internal', 'errors.users.inviteFailed', { cause: error });
  }

  return withActor(db, actor, async (tx) => {
    // The trigger created this row with least privilege: editor, no sensitive
    // access. Anything above that is an explicit, audited grant.
    const [created] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.id, invited.id))
      .limit(1);
    if (!created) throw new AppError('internal', 'errors.users.profileMissing');

    const role = input.role ?? 'editor';
    const canViewSensitive = input.canViewSensitive ?? false;
    const needsUpdate = role !== created.role || canViewSensitive !== created.canViewSensitive;

    const row = needsUpdate
      ? one(
          await tx
            .update(profiles)
            .set({ role, canViewSensitive, updatedAt: new Date() })
            .where(eq(profiles.id, created.id))
            .returning(),
          'profile',
        )
      : created;

    await writeAudit(tx, actor, {
      action: 'invite',
      entityType: 'profile',
      entityId: row.id,
      diff: {
        email: { from: null, to: row.email },
        role: { from: null, to: row.role },
        canViewSensitive: { from: null, to: row.canViewSensitive },
      },
    });

    return toSummary(row);
  });
}

export async function setUserRole(
  db: Db,
  actor: Actor,
  userId: string,
  role: UserRole,
): Promise<UserSummary> {
  assertCan(actor, 'users.manage');
  if (userId === actor.id) throw forbiddenSelf('errors.users.selfRole');

  return withActor(db, actor, async (tx) => {
    const [existing] = await tx.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
    if (!existing) throw notFound('profile');
    if (existing.role === role) return toSummary(existing);

    const row = one(
      await tx
        .update(profiles)
        .set({ role, updatedAt: new Date() })
        .where(eq(profiles.id, userId))
        .returning()
        .catch(translateDbRefusal),
      'profile',
    );

    await writeAudit(tx, actor, {
      action: 'set_role',
      entityType: 'profile',
      entityId: userId,
      diff: { role: { from: existing.role, to: row.role } },
    });

    return toSummary(row);
  });
}

export async function setSensitiveAccess(
  db: Db,
  actor: Actor,
  userId: string,
  canViewSensitive: boolean,
): Promise<UserSummary> {
  assertCan(actor, 'users.manage');

  return withActor(db, actor, async (tx) => {
    const [existing] = await tx.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
    if (!existing) throw notFound('profile');
    if (existing.canViewSensitive === canViewSensitive) return toSummary(existing);

    const row = one(
      await tx
        .update(profiles)
        .set({ canViewSensitive, updatedAt: new Date() })
        .where(eq(profiles.id, userId))
        .returning()
        .catch(translateDbRefusal),
      'profile',
    );

    await writeAudit(tx, actor, {
      action: 'update',
      entityType: 'profile',
      entityId: userId,
      diff: computeDiff(existing, row),
    });

    return toSummary(row);
  });
}

export async function setUserActive(
  db: Db,
  actor: Actor,
  userId: string,
  isActive: boolean,
): Promise<UserSummary> {
  assertCan(actor, 'users.manage');
  if (userId === actor.id && !isActive) throw forbiddenSelf('errors.users.selfDeactivate');

  return withActor(db, actor, async (tx) => {
    const [existing] = await tx.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
    if (!existing) throw notFound('profile');
    if (existing.isActive === isActive) return toSummary(existing);

    const row = one(
      await tx
        .update(profiles)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(profiles.id, userId))
        .returning()
        .catch(translateDbRefusal),
      'profile',
    );

    await writeAudit(tx, actor, {
      action: isActive ? 'update' : 'deactivate',
      entityType: 'profile',
      entityId: userId,
      diff: { isActive: { from: existing.isActive, to: row.isActive } },
    });

    return toSummary(row);
  });
}

function forbiddenSelf(messageKey: string) {
  return new AppError('forbidden', messageKey);
}
