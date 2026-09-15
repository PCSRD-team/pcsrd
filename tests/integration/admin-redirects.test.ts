import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import { auditLogs, profiles, redirects } from '@/db/schema';
import type { Actor } from '@/services/_shared/actor';
import {
  createRedirect,
  deleteRedirect,
  normalizeSourcePath,
} from '@/services/content/redirect.service';
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
const MANAGER: Actor = { ...ADMIN, id: '22222222-2222-2222-2222-222222222222', role: 'content_manager' };

beforeEach(async () => {
  await resetTables(getDb());
  await getDb()
    .insert(profiles)
    .values([
      { id: ADMIN.id, email: 'a@example.org', fullName: 'Admin', role: 'admin' },
      { id: MANAGER.id, email: 'm@example.org', fullName: 'Manager', role: 'content_manager' },
    ]);
});

const input = () => ({
  sourcePath: '/old-page',
  destinationPath: '/ar/about',
  statusCode: '308' as const,
});

describe('createRedirect', () => {
  it('stores the rule with a numeric status code and writes an audit entry', async () => {
    const { id } = await createRedirect(db(), ADMIN, input());

    const stored = row1(await getDb().select().from(redirects));
    expect(stored.id).toBe(id);
    expect(stored.sourcePath).toBe('/old-page');
    expect(stored.destinationPath).toBe('/ar/about');
    expect(stored.statusCode).toBe(308);

    const entry = row1(await getDb().select().from(auditLogs));
    expect(entry).toMatchObject({ action: 'create', entityType: 'redirect', entityId: id, actorId: ADMIN.id });
  });

  it('normalises a trailing slash so two spellings cannot become two rules', async () => {
    expect(normalizeSourcePath('/old-page/')).toBe('/old-page');
    expect(normalizeSourcePath('/')).toBe('/');

    await createRedirect(db(), ADMIN, { ...input(), sourcePath: '/old-page/' });
    await expect(createRedirect(db(), ADMIN, input())).rejects.toMatchObject({
      code: 'conflict',
      fieldErrors: { sourcePath: ['errors.redirects.sourceTaken'] },
    });
  });

  it('refuses a duplicate source with a field error rather than a constraint violation', async () => {
    await createRedirect(db(), ADMIN, input());
    await expect(createRedirect(db(), ADMIN, input())).rejects.toMatchObject({
      code: 'conflict',
      message: 'errors.redirects.sourceTaken',
    });
    expect(await getDb().select().from(redirects)).toHaveLength(1);
  });

  it('is admin only — a content manager is refused before anything is written', async () => {
    await expect(createRedirect(db(), MANAGER, input())).rejects.toMatchObject({ code: 'forbidden' });
    expect(await getDb().select().from(redirects)).toHaveLength(0);
    expect(await getDb().select().from(auditLogs)).toHaveLength(0);
  });
});

describe('deleteRedirect', () => {
  it('removes the row and audits the deletion with the old values', async () => {
    const { id } = await createRedirect(db(), ADMIN, input());
    await deleteRedirect(db(), ADMIN, id);

    expect(await getDb().select().from(redirects)).toHaveLength(0);
    const entries = await getDb().select().from(auditLogs);
    expect(entries.map((e) => e.action)).toEqual(['create', 'delete']);
    expect(entries[1]?.diff).toMatchObject({ sourcePath: { from: '/old-page' } });
  });

  it('reports a missing row as not found', async () => {
    await expect(
      deleteRedirect(db(), ADMIN, '99999999-9999-4999-8999-999999999999'),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('is admin only', async () => {
    const { id } = await createRedirect(db(), ADMIN, input());
    await expect(deleteRedirect(db(), MANAGER, id)).rejects.toMatchObject({ code: 'forbidden' });
    expect(await getDb().select().from(redirects)).toHaveLength(1);
  });
});
