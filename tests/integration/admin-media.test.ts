import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import { auditLogs, mediaAssets, partners, profiles, projectMedia, projects, programs } from '@/db/schema';
import type { Actor } from '@/services/_shared/actor';
import { deleteMedia, listMediaUsage, updateMedia } from '@/services/media/media.service';
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

let mediaId: string;
let programId: string;

beforeEach(async () => {
  await resetTables(getDb());
  await getDb()
    .insert(profiles)
    .values([
      { id: ADMIN.id, email: 'a@example.org', fullName: 'Admin', role: 'admin' },
      { id: MANAGER.id, email: 'm@example.org', fullName: 'Manager', role: 'content_manager' },
      { id: EDITOR.id, email: 'e@example.org', fullName: 'Editor', role: 'editor' },
    ]);

  mediaId = row1(
    await getDb()
      .insert(mediaAssets)
      .values({
        path: 'media/photo.webp',
        mimeType: 'image/webp',
        fileSize: 1000,
        altAr: 'صورة',
        consent: 'not_required',
      })
      .returning({ id: mediaAssets.id }),
  ).id;

  programId = row1(
    await getDb()
      .insert(programs)
      .values({ key: 'protection', titleAr: 'الحماية', slugAr: 'الحماية', slugEn: 'protection' })
      .returning({ id: programs.id }),
  ).id;
});

describe('updateMedia', () => {
  it('refuses to blank the Arabic alt text', async () => {
    await expect(updateMedia(db(), EDITOR, mediaId, { altAr: '   ' })).rejects.toMatchObject({
      code: 'validation',
      fieldErrors: { altAr: ['errors.field.required'] },
    });
  });

  it('updates the descriptive fields and audits the diff', async () => {
    await updateMedia(db(), EDITOR, mediaId, { altAr: 'صورة محدّثة', credit: 'PCSRD' });
    const stored = row1(await getDb().select().from(mediaAssets));
    expect(stored).toMatchObject({ altAr: 'صورة محدّثة', credit: 'PCSRD' });
    const entry = row1(await getDb().select().from(auditLogs));
    expect(entry).toMatchObject({ action: 'update', entityType: 'media_asset', entityId: mediaId });
    expect(entry.diff).toMatchObject({ altAr: { from: 'صورة', to: 'صورة محدّثة' } });
  });
});

describe('deleteMedia', () => {
  it('deletes an unreferenced asset and returns its storage coordinates', async () => {
    const stored = await deleteMedia(db(), MANAGER, mediaId);
    expect(stored).toEqual({ bucket: 'media', path: 'media/photo.webp' });
    expect(await getDb().select().from(mediaAssets)).toHaveLength(0);
    const entry = row1(await getDb().select().from(auditLogs));
    expect(entry).toMatchObject({ action: 'delete', entityType: 'media_asset', entityId: mediaId });
  });

  it('refuses an asset referenced as a hero image, naming the usage', async () => {
    await getDb().insert(projects).values({
      programId,
      titleAr: 'مشروع',
      slugAr: 'مشروع',
      slugEn: 'project',
      heroMediaId: mediaId,
    });

    await expect(deleteMedia(db(), ADMIN, mediaId)).rejects.toMatchObject({
      code: 'conflict',
      message: 'errors.mediaInUse',
      meta: { usages: [{ entityType: 'project', field: 'hero_media_id' }] },
    });
    // Nothing was written: no delete, no audit entry.
    expect(await getDb().select().from(mediaAssets)).toHaveLength(1);
    expect(await getDb().select().from(auditLogs)).toHaveLength(0);
  });

  it('refuses an asset referenced through a gallery junction or a partner logo', async () => {
    const projectId = row1(
      await getDb()
        .insert(projects)
        .values({ programId, titleAr: 'مشروع', slugAr: 'مشروع', slugEn: 'project' })
        .returning({ id: projects.id }),
    ).id;
    await getDb().insert(projectMedia).values({ projectId, mediaId, displayOrder: 0 });
    await getDb().insert(partners).values({ nameAr: 'شريك', type: 'donor', logoMediaId: mediaId });

    const usages = await listMediaUsage(db(), mediaId);
    expect(usages.map((u) => u.entityType).sort()).toEqual(['partner', 'project_gallery']);

    await expect(deleteMedia(db(), ADMIN, mediaId)).rejects.toMatchObject({ code: 'conflict' });

    // Remove the references and the delete goes through.
    await getDb().delete(projectMedia).where(eq(projectMedia.mediaId, mediaId));
    await getDb().update(partners).set({ logoMediaId: null });
    await deleteMedia(db(), ADMIN, mediaId);
    expect(await getDb().select().from(mediaAssets)).toHaveLength(0);
  });

  it('is refused for an editor', async () => {
    await expect(deleteMedia(db(), EDITOR, mediaId)).rejects.toMatchObject({ code: 'forbidden' });
  });
});
