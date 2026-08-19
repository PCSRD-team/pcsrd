import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import { mediaAssets, partners, profiles, programs, projectPartners, projects } from '@/db/schema';
import type { Actor } from '@/services/_shared/actor';
import {
  deleteProject,
  setProjectStatus,
  upsertProject,
} from '@/services/content/project.service';
import { resetTables, useTestDb } from '../setup/pglite';

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

let programId: string;
let safeMediaId: string;
let minorMediaId: string;
let partnerId: string;

beforeEach(async () => {
  await resetTables(getDb());

  await getDb()
    .insert(profiles)
    .values([
      { id: ADMIN.id, email: 'a@example.org', fullName: 'Admin', role: 'admin' },
      { id: MANAGER.id, email: 'm@example.org', fullName: 'Manager', role: 'content_manager' },
      { id: EDITOR.id, email: 'e@example.org', fullName: 'Editor', role: 'editor' },
    ]);

  [{ id: programId }] = await getDb()
    .insert(programs)
    .values({
      key: 'protection',
      titleAr: 'الحماية',
      slugAr: 'الحماية',
      slugEn: 'protection',
      status: 'published',
    })
    .returning({ id: programs.id });

  const media = await getDb()
    .insert(mediaAssets)
    .values([
      {
        path: 'media/safe.webp',
        mimeType: 'image/webp',
        fileSize: 1000,
        altAr: 'صورة عامة',
        consent: 'not_required',
        hasIdentifiableMinors: false,
      },
      {
        path: 'media/children.webp',
        mimeType: 'image/webp',
        fileSize: 1000,
        altAr: 'أطفال في جلسة دعم',
        consent: 'pending',
        hasIdentifiableMinors: true,
      },
    ])
    .returning({ id: mediaAssets.id });
  safeMediaId = media[0].id;
  minorMediaId = media[1].id;

  [{ id: partnerId }] = await getDb()
    .insert(partners)
    .values({ nameAr: 'شريك', type: 'implementing', status: 'published' })
    .returning({ id: partners.id });
});

const base = () => ({
  programId,
  titleAr: 'مشروع الأمل',
  titleEn: 'Project Amal',
});

describe('upsertProject', () => {
  it('derives both slugs and stores the row as a draft by default', async () => {
    const result = await upsertProject(db(), EDITOR, base());

    expect(result.status).toBe('draft');
    expect(result.slugAr).toBe('مشروع-الأمل');
    expect(result.slugEn).toBe('project-amal');
  });

  it('falls back to the Arabic slug when there is no English title', async () => {
    const result = await upsertProject(db(), EDITOR, {
      programId,
      titleAr: 'مشروع الأمل',
    });
    // Both slugs must exist, otherwise /en/... is unroutable and the
    // untranslated-content state becomes a 404.
    expect(result.slugEn).toBe(result.slugAr);
  });

  it('rejects a duplicate slug with a field error rather than a constraint violation', async () => {
    await upsertProject(db(), EDITOR, base());

    await expect(upsertProject(db(), EDITOR, base())).rejects.toMatchObject({
      code: 'conflict',
      fieldErrors: { slugAr: ['errors.slug.taken'], slugEn: ['errors.slug.taken'] },
    });
  });

  it('lets a row keep its own slug on update', async () => {
    const created = await upsertProject(db(), EDITOR, base());
    const updated = await upsertProject(db(), EDITOR, {
      ...base(),
      id: created.id,
      summaryAr: 'ملخص',
    });
    expect(updated.id).toBe(created.id);
  });

  it('refuses to let an editor publish', async () => {
    await expect(
      upsertProject(db(), EDITOR, { ...base(), status: 'published' }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('lets a content manager publish', async () => {
    const result = await upsertProject(db(), MANAGER, {
      ...base(),
      status: 'published',
      heroMediaId: safeMediaId,
    });
    expect(result.status).toBe('published');
  });

  it('blocks publication when a referenced photograph shows minors without consent', async () => {
    await expect(
      upsertProject(db(), MANAGER, {
        ...base(),
        status: 'published',
        heroMediaId: minorMediaId,
      }),
    ).rejects.toMatchObject({ code: 'consent_required' });
  });

  it('allows the same photograph once consent is recorded', async () => {
    await getDb()
      .update(mediaAssets)
      .set({ consent: 'obtained', consentReference: 'CONSENT-2026-014' })
      .where(eq(mediaAssets.id, minorMediaId));

    const result = await upsertProject(db(), MANAGER, {
      ...base(),
      status: 'published',
      heroMediaId: minorMediaId,
    });
    expect(result.status).toBe('published');
  });

  it('checks gallery media too, not only the hero', async () => {
    await expect(
      upsertProject(db(), MANAGER, {
        ...base(),
        status: 'published',
        heroMediaId: safeMediaId,
        media: [{ mediaId: minorMediaId }],
      }),
    ).rejects.toMatchObject({ code: 'consent_required' });
  });

  it('replaces partner links wholesale so the last one can be removed', async () => {
    const created = await upsertProject(db(), EDITOR, {
      ...base(),
      partners: [{ partnerId, role: 'implementing' }],
    });

    expect(
      await getDb().select().from(projectPartners).where(eq(projectPartners.projectId, created.id)),
    ).toHaveLength(1);

    await upsertProject(db(), EDITOR, { ...base(), id: created.id, partners: [] });

    expect(
      await getDb().select().from(projectPartners).where(eq(projectPartners.projectId, created.id)),
    ).toHaveLength(0);
  });

  it('records the same organisation as both implementer and donor', async () => {
    const created = await upsertProject(db(), EDITOR, {
      ...base(),
      partners: [
        { partnerId, role: 'implementing' },
        { partnerId, role: 'donor' },
      ],
    });

    const links = await getDb()
      .select()
      .from(projectPartners)
      .where(eq(projectPartners.projectId, created.id));
    expect(links).toHaveLength(2);
  });

  it('writes an audit entry naming only the fields that changed', async () => {
    const created = await upsertProject(db(), EDITOR, base());
    await upsertProject(db(), EDITOR, { ...base(), id: created.id, summaryAr: 'ملخص جديد' });

    const audit = await getDb().query.auditLogs.findMany();
    expect(audit.map((a) => a.action)).toEqual(['create', 'update']);

    const diff = audit[1].diff!;
    expect(Object.keys(diff)).toEqual(['summaryAr']);
    expect(diff.summaryAr).toEqual({ from: null, to: 'ملخص جديد' });
  });

  it('rolls the whole transaction back when a gate fires after the row is written', async () => {
    await expect(
      upsertProject(db(), MANAGER, {
        ...base(),
        status: 'published',
        media: [{ mediaId: minorMediaId }],
      }),
    ).rejects.toThrow();

    expect(await getDb().select().from(projects)).toHaveLength(0);
    expect(await getDb().query.auditLogs.findMany()).toHaveLength(0);
  });
});

describe('setProjectStatus', () => {
  it('sets published_at once and keeps it across a republish', async () => {
    const created = await upsertProject(db(), EDITOR, base());
    await setProjectStatus(db(), MANAGER, created.id, 'published');

    const [first] = await getDb().select().from(projects).where(eq(projects.id, created.id));
    expect(first.publishedAt).toBeInstanceOf(Date);

    await setProjectStatus(db(), MANAGER, created.id, 'archived');
    await setProjectStatus(db(), MANAGER, created.id, 'published');

    const [again] = await getDb().select().from(projects).where(eq(projects.id, created.id));
    expect(again.publishedAt?.getTime()).toBe(first.publishedAt?.getTime());
  });

  it('refuses an editor unpublishing a live page', async () => {
    const created = await upsertProject(db(), MANAGER, { ...base(), status: 'published' });
    await expect(
      setProjectStatus(db(), EDITOR, created.id, 'draft'),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('deleteProject', () => {
  it('refuses everyone below admin', async () => {
    const created = await upsertProject(db(), EDITOR, base());
    await expect(deleteProject(db(), MANAGER, created.id)).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('refuses to delete a published project before it is taken down', async () => {
    const created = await upsertProject(db(), MANAGER, { ...base(), status: 'published' });
    await expect(deleteProject(db(), ADMIN, created.id)).rejects.toMatchObject({
      code: 'conflict',
    });
  });

  it('deletes an archived project and its junction rows', async () => {
    const created = await upsertProject(db(), EDITOR, {
      ...base(),
      partners: [{ partnerId, role: 'donor' }],
    });
    await deleteProject(db(), ADMIN, created.id);

    expect(await getDb().select().from(projects)).toHaveLength(0);
    expect(await getDb().select().from(projectPartners)).toHaveLength(0);
  });
});
