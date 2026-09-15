import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import { mediaAssets, pages, profiles, programMedia, programs } from '@/db/schema';
import type { Actor } from '@/services/_shared/actor';
import { pageService, programService } from '@/services/content';
import { resetTables, useTestDb } from '../setup/pglite';
import { row1 } from '../setup/rows';

const getDb = useTestDb();
const db = () => getDb() as unknown as Db;

const MANAGER: Actor = {
  id: '22222222-2222-2222-2222-222222222222',
  role: 'content_manager',
  canViewSensitive: false,
  isActive: true,
};

let programId: string;
let mediaId: string;

/**
 * The data-loss class: a service that rebuilds the whole row on save must not
 * reset a column the form did not post. These pin the columns that used to be
 * wiped on every edit.
 */
beforeEach(async () => {
  await resetTables(getDb());
  await getDb()
    .insert(profiles)
    .values({ id: MANAGER.id, email: 'm@example.org', fullName: 'Manager', role: 'content_manager' });

  programId = row1(
    await getDb()
      .insert(programs)
      .values({
        key: 'early_recovery',
        titleAr: 'التعافي المبكر',
        slugAr: 'التعافي',
        slugEn: 'recovery',
        accentToken: '--color-prog-recovery',
        specificObjectives: [{ title_ar: 'هدف' }],
        keyInterventions: [{ title_ar: 'تدخّل' }],
      })
      .returning({ id: programs.id }),
  ).id;

  mediaId = row1(
    await getDb()
      .insert(mediaAssets)
      .values({ path: 'media/a.webp', mimeType: 'image/webp', fileSize: 10, altAr: 'صورة' })
      .returning({ id: mediaAssets.id }),
  ).id;
  await getDb().insert(programMedia).values({ programId, mediaId, displayOrder: 0 });
});

describe('programme save', () => {
  it('keeps accent_token and the structured arrays when the form does not post them', async () => {
    await programService.upsert(db(), MANAGER, {
      id: programId,
      key: 'early_recovery',
      titleAr: 'التعافي المبكر — محدّث',
    });

    const stored = row1(await getDb().select().from(programs).where(eq(programs.id, programId)));
    expect(stored.titleAr).toBe('التعافي المبكر — محدّث');
    expect(stored.accentToken).toBe('--color-prog-recovery');
    expect(stored.specificObjectives).toEqual([{ title_ar: 'هدف' }]);
    expect(stored.keyInterventions).toEqual([{ title_ar: 'تدخّل' }]);
  });

  it('keeps the gallery when `media` is not posted, and replaces it when it is', async () => {
    await programService.upsert(db(), MANAGER, {
      id: programId,
      key: 'early_recovery',
      titleAr: 'التعافي المبكر',
    });
    expect(
      await getDb().select().from(programMedia).where(eq(programMedia.programId, programId)),
    ).toHaveLength(1);

    await programService.upsert(db(), MANAGER, {
      id: programId,
      key: 'early_recovery',
      titleAr: 'التعافي المبكر',
      media: [],
    });
    expect(
      await getDb().select().from(programMedia).where(eq(programMedia.programId, programId)),
    ).toHaveLength(0);
  });

  it('returns the key so the action can bust the key-based cache tag', async () => {
    const result = await programService.upsert(db(), MANAGER, {
      id: programId,
      key: 'early_recovery',
      titleAr: 'التعافي المبكر',
    });
    expect(result.key).toBe('early_recovery');
  });
});

describe('page save', () => {
  it('returns the key on create, update and status change', async () => {
    const created = await pageService.upsert(db(), MANAGER, {
      key: 'privacy',
      titleAr: 'الخصوصية',
    });
    expect(created.key).toBe('privacy');

    const published = await pageService.setStatus(db(), MANAGER, created.id, 'published');
    expect(published.key).toBe('privacy');

    const stored = row1(await getDb().select().from(pages).where(eq(pages.id, created.id)));
    expect(stored.status).toBe('published');
  });
});
