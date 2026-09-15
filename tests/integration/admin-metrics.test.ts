import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import { auditLogs, impactMetrics, profiles } from '@/db/schema';
import type { Actor } from '@/services/_shared/actor';
import { deleteMetric, upsertMetric } from '@/services/content/catalog.service';
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
const EDITOR: Actor = { ...ADMIN, id: '33333333-3333-3333-3333-333333333333', role: 'editor' };

beforeEach(async () => {
  await resetTables(getDb());
  await getDb()
    .insert(profiles)
    .values([
      { id: ADMIN.id, email: 'a@example.org', fullName: 'Admin', role: 'admin' },
      { id: MANAGER.id, email: 'm@example.org', fullName: 'Manager', role: 'content_manager' },
      { id: EDITOR.id, email: 'e@example.org', fullName: 'Editor', role: 'editor' },
    ]);
});

const base = () => ({
  labelAr: 'مستفيدون',
  value: '1250',
  unit: 'مستفيد',
  periodStart: '2025-01-01',
  periodEnd: '2025-12-31',
  status: 'reported' as const,
});

/**
 * The invariant: an impact figure is never published without its period and
 * verification status. The period columns are `not null`, so the part a
 * schema cannot express is checked here — public means `verified` with a
 * source, and nothing else.
 */
describe('upsertMetric — publish invariant', () => {
  it('stores a private reported figure without a source', async () => {
    const { id } = await upsertMetric(db(), EDITOR, base());
    const stored = row1(await getDb().select().from(impactMetrics));
    expect(stored.id).toBe(id);
    expect(stored.isPublic).toBe(false);
    // `numeric(…, 2)` comes back with its scale; the digits are what matter.
    expect(Number(stored.value)).toBe(1250);
  });

  it('refuses to publish a figure that is not verified, on the status field', async () => {
    await expect(
      upsertMetric(db(), MANAGER, { ...base(), isPublic: true, verificationSource: 'تقرير 2025' }),
    ).rejects.toMatchObject({
      code: 'validation',
      fieldErrors: { status: ['errors.metric.mustBeVerified'] },
    });
    expect(await getDb().select().from(impactMetrics)).toHaveLength(0);
  });

  it('refuses to publish a verified figure with no source, on the source field', async () => {
    await expect(
      upsertMetric(db(), MANAGER, { ...base(), status: 'verified', isPublic: true }),
    ).rejects.toMatchObject({
      code: 'validation',
      fieldErrors: { verificationSource: ['errors.metric.sourceRequired'] },
    });
  });

  it('publishes a verified figure with a source, and audits the write', async () => {
    const { id } = await upsertMetric(db(), MANAGER, {
      ...base(),
      status: 'verified',
      verificationSource: 'تقييم خارجي 2025',
      isPublic: true,
    });
    const stored = row1(await getDb().select().from(impactMetrics));
    expect(stored).toMatchObject({ id, isPublic: true, status: 'verified' });

    const entry = row1(await getDb().select().from(auditLogs));
    expect(entry).toMatchObject({ action: 'create', entityType: 'impact_metric', entityId: id });
  });

  it('refuses to let an editor make a figure public', async () => {
    await expect(
      upsertMetric(db(), EDITOR, {
        ...base(),
        status: 'verified',
        verificationSource: 'مصدر',
        isPublic: true,
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('cannot un-verify a public figure on update — the invariant holds for edits too', async () => {
    const { id } = await upsertMetric(db(), MANAGER, {
      ...base(),
      status: 'verified',
      verificationSource: 'مصدر',
      isPublic: true,
    });
    await expect(
      upsertMetric(db(), MANAGER, {
        ...base(),
        id,
        status: 'target',
        verificationSource: 'مصدر',
        isPublic: true,
      }),
    ).rejects.toMatchObject({ code: 'validation' });
  });

  it('rejects a period that ends before it starts, from the database constraint', async () => {
    await expect(
      upsertMetric(db(), EDITOR, { ...base(), periodStart: '2025-12-31', periodEnd: '2025-01-01' }),
    ).rejects.toBeTruthy();
    expect(await getDb().select().from(impactMetrics)).toHaveLength(0);
  });
});

describe('deleteMetric', () => {
  it('is admin only and audited', async () => {
    const { id } = await upsertMetric(db(), EDITOR, base());
    await expect(deleteMetric(db(), MANAGER, id)).rejects.toMatchObject({ code: 'forbidden' });

    await deleteMetric(db(), ADMIN, id);
    expect(await getDb().select().from(impactMetrics)).toHaveLength(0);
    const entries = await getDb().select().from(auditLogs);
    expect(entries.map((e) => e.action)).toEqual(['create', 'delete']);
  });
});
