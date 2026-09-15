import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import { auditLogs, profiles } from '@/db/schema';
import type { Actor } from '@/services/_shared/actor';
import {
  type AuthAdminPort,
  inviteUser,
  setSensitiveAccess,
  setUserActive,
  setUserRole,
} from '@/services/users/user.service';
import { resetTables, useTestDb } from '../setup/pglite';
import { row1 } from '../setup/rows';

const getDb = useTestDb();
const db = () => getDb() as unknown as Db;

const ADMIN: Actor = {
  id: '11111111-1111-1111-1111-111111111111',
  role: 'admin',
  canViewSensitive: false,
  isActive: true,
};
const SECOND_ADMIN: Actor = { ...ADMIN, id: '44444444-4444-4444-4444-444444444444' };
const MANAGER: Actor = { ...ADMIN, id: '22222222-2222-2222-2222-222222222222', role: 'content_manager' };
const EDITOR: Actor = { ...ADMIN, id: '33333333-3333-3333-3333-333333333333', role: 'editor' };

/**
 * Stands in for Supabase Auth **and** the `handle_new_user` trigger: in
 * production the trigger on `auth.users` creates the profile with least
 * privilege, and PGlite has no `auth` schema, so the fake does what the
 * trigger would.
 */
function fakeAuth(id = '55555555-5555-4555-8555-555555555555'): AuthAdminPort & { calls: string[] } {
  const port = {
    calls: [] as string[],
    async inviteByEmail(email: string, fullName: string) {
      port.calls.push(email);
      await getDb()
        .insert(profiles)
        .values({ id, email, fullName, role: 'editor', canViewSensitive: false, isActive: true });
      return { id };
    },
  };
  return port;
}

beforeEach(async () => {
  await resetTables(getDb());
  await getDb()
    .insert(profiles)
    .values([
      { id: ADMIN.id, email: 'a@example.org', fullName: 'Admin', role: 'admin' },
      { id: SECOND_ADMIN.id, email: 'a2@example.org', fullName: 'Admin 2', role: 'admin' },
      { id: MANAGER.id, email: 'm@example.org', fullName: 'Manager', role: 'content_manager' },
      { id: EDITOR.id, email: 'e@example.org', fullName: 'Editor', role: 'editor' },
    ]);
});

describe('inviteUser', () => {
  it('invites through the port, keeps least privilege by default, and audits it', async () => {
    const auth = fakeAuth();
    const user = await inviteUser(
      db(),
      ADMIN,
      { email: 'New.Person@Example.org', fullName: 'New Person' },
      auth,
    );

    expect(auth.calls).toEqual(['new.person@example.org']);
    expect(user).toMatchObject({ role: 'editor', canViewSensitive: false, isActive: true });

    const entry = row1(await getDb().select().from(auditLogs));
    expect(entry).toMatchObject({ action: 'invite', entityType: 'profile', entityId: user.id });
  });

  it('applies a requested role and sensitive access as an explicit grant', async () => {
    const user = await inviteUser(
      db(),
      ADMIN,
      { email: 'cm@example.org', fullName: 'CM', role: 'content_manager', canViewSensitive: true },
      fakeAuth(),
    );
    expect(user).toMatchObject({ role: 'content_manager', canViewSensitive: true });
  });

  it('refuses a duplicate email before calling the auth provider', async () => {
    const auth = fakeAuth();
    await expect(
      inviteUser(db(), ADMIN, { email: 'e@example.org', fullName: 'Dup' }, auth),
    ).rejects.toMatchObject({ code: 'conflict', fieldErrors: { email: ['errors.users.emailTaken'] } });
    expect(auth.calls).toEqual([]);
  });

  it('is admin only', async () => {
    const auth = fakeAuth();
    await expect(
      inviteUser(db(), MANAGER, { email: 'x@example.org', fullName: 'X' }, auth),
    ).rejects.toMatchObject({ code: 'forbidden' });
    expect(auth.calls).toEqual([]);
  });

  it('surfaces a provider failure as a translated error', async () => {
    const auth: AuthAdminPort = {
      inviteByEmail: async () => {
        throw new Error('provider down');
      },
    };
    await expect(
      inviteUser(db(), ADMIN, { email: 'x@example.org', fullName: 'X' }, auth),
    ).rejects.toMatchObject({ code: 'internal', message: 'errors.users.inviteFailed' });
  });
});

describe('setUserRole', () => {
  it('changes the role and writes a set_role entry with the diff', async () => {
    const user = await setUserRole(db(), ADMIN, EDITOR.id, 'content_manager');
    expect(user.role).toBe('content_manager');

    const entry = row1(await getDb().select().from(auditLogs));
    expect(entry).toMatchObject({
      action: 'set_role',
      entityId: EDITOR.id,
      diff: { role: { from: 'editor', to: 'content_manager' } },
    });
  });

  it('refuses a self role change', async () => {
    await expect(setUserRole(db(), ADMIN, ADMIN.id, 'editor')).rejects.toMatchObject({
      code: 'forbidden',
      message: 'errors.users.selfRole',
    });
    const [me] = await getDb().select().from(profiles).where(eq(profiles.id, ADMIN.id));
    expect(me?.role).toBe('admin');
  });

  it('refuses demoting the last active admin, via the database trigger', async () => {
    // Remove the second admin first so ADMIN is the last one standing, then
    // have SECOND_ADMIN (now inactive, but the service takes the actor as
    // given) try to demote them: the trigger's universal rule fires.
    await setUserActive(db(), ADMIN, SECOND_ADMIN.id, false);
    await expect(setUserRole(db(), SECOND_ADMIN, ADMIN.id, 'editor')).rejects.toMatchObject({
      code: 'conflict',
      message: 'errors.users.lastAdmin',
    });
  });

  it('is admin only', async () => {
    await expect(setUserRole(db(), MANAGER, EDITOR.id, 'admin')).rejects.toMatchObject({
      code: 'forbidden',
    });
  });
});

describe('setSensitiveAccess', () => {
  it('grants and revokes per person, as an audited update', async () => {
    const granted = await setSensitiveAccess(db(), ADMIN, MANAGER.id, true);
    expect(granted.canViewSensitive).toBe(true);
    const revoked = await setSensitiveAccess(db(), ADMIN, MANAGER.id, false);
    expect(revoked.canViewSensitive).toBe(false);

    const entries = await getDb().select().from(auditLogs);
    expect(entries.map((e) => e.action)).toEqual(['update', 'update']);
    expect(entries[0]?.diff).toMatchObject({ canViewSensitive: { from: false, to: true } });
  });

  it('is a no-op without an audit entry when nothing changes', async () => {
    await setSensitiveAccess(db(), ADMIN, MANAGER.id, false);
    expect(await getDb().select().from(auditLogs)).toHaveLength(0);
  });
});

describe('setUserActive', () => {
  it('deactivates with a deactivate entry and reactivates with an update entry', async () => {
    const off = await setUserActive(db(), ADMIN, EDITOR.id, false);
    expect(off.isActive).toBe(false);
    const on = await setUserActive(db(), ADMIN, EDITOR.id, true);
    expect(on.isActive).toBe(true);

    const entries = await getDb().select().from(auditLogs);
    expect(entries.map((e) => e.action)).toEqual(['deactivate', 'update']);
  });

  it('refuses self-deactivation', async () => {
    await expect(setUserActive(db(), ADMIN, ADMIN.id, false)).rejects.toMatchObject({
      code: 'forbidden',
      message: 'errors.users.selfDeactivate',
    });
  });

  it('refuses deactivating the last active admin, via the database trigger', async () => {
    await setUserActive(db(), ADMIN, SECOND_ADMIN.id, false);
    await expect(setUserActive(db(), SECOND_ADMIN, ADMIN.id, false)).rejects.toMatchObject({
      code: 'conflict',
      message: 'errors.users.lastAdmin',
    });
    const [me] = await getDb().select().from(profiles).where(eq(profiles.id, ADMIN.id));
    expect(me?.isActive).toBe(true);
  });
});
