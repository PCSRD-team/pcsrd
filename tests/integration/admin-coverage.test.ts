import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import {
  mediaAssets,
  organizationSettings,
  pages,
  postMedia,
  posts,
  profiles,
  programs,
  stories,
  storyMedia,
  vacancies,
} from '@/db/schema';
import type { Actor } from '@/services/_shared/actor';
import { pageService, postService, programService, storyService, vacancyService } from '@/services/content';
import { updateOrganization } from '@/services/content/catalog.service';
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
const MANAGER: Actor = {
  ...ADMIN,
  id: '22222222-2222-2222-2222-222222222222',
  role: 'content_manager',
};
const EDITOR: Actor = {
  ...ADMIN,
  id: '33333333-3333-3333-3333-333333333333',
  role: 'editor',
};

/**
 * The second half of "does the application expose the database": a column or a
 * constraint that no screen can reach in one direction or the other.
 *
 * Every case here failed before the change it pins:
 *
 * - a duplicate `pages.key` reached Postgres and came back as a unique
 *   violation naming `pages_key_key`;
 * - a content manager could open the organisation settings and never save
 *   them, because the one form posts every field and the check asked whether a
 *   restricted field was *mentioned*, not whether it changed;
 * - `vacancies.posted_at` is rendered to the public as the posting date and no
 *   form could set it.
 */
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

// ── Unique `key` columns ─────────────────────────────────────────────────

describe('pages and programmes — the `key` unique constraint', () => {
  it('refuses a second page with a taken key, with the error on the field', async () => {
    await pageService.upsert(db(), MANAGER, { key: 'privacy', titleAr: 'الخصوصية' });

    await expect(
      pageService.upsert(db(), MANAGER, { key: 'privacy', titleAr: 'سياسة الخصوصية' }),
    ).rejects.toMatchObject({
      code: 'conflict',
      fieldErrors: { key: ['errors.content.keyTaken'] },
    });

    expect(await getDb().select().from(pages)).toHaveLength(1);
  });

  it('lets a page keep its own key on edit', async () => {
    const created = await pageService.upsert(db(), MANAGER, {
      key: 'terms',
      titleAr: 'الشروط',
    });

    const updated = await pageService.upsert(db(), MANAGER, {
      id: created.id,
      key: 'terms',
      titleAr: 'الشروط والأحكام',
    });

    expect(updated.id).toBe(created.id);
  });

  it('refuses pointing a second programme at a taken key', async () => {
    await programService.upsert(db(), MANAGER, {
      key: 'protection',
      titleAr: 'الحماية',
    });
    const second = await programService.upsert(db(), MANAGER, {
      key: 'early_recovery',
      titleAr: 'التعافي المبكر',
    });

    await expect(
      programService.upsert(db(), MANAGER, {
        id: second.id,
        key: 'protection',
        titleAr: 'التعافي المبكر',
      }),
    ).rejects.toMatchObject({ code: 'conflict' });

    const stored = row1(
      await getDb().select().from(programs).where(eq(programs.id, second.id)),
    );
    expect(stored.key).toBe('early_recovery');
  });
});

// ── Organisation settings ────────────────────────────────────────────────

const ORG_ROW = {
  id: true,
  legalNameAr: 'جمعية فلسطين',
  legalNameEn: 'Palestine Society',
  shortNameAr: 'الجمعية',
  shortNameEn: 'The Society',
  acronym: 'PCSRD',
  foundedYear: 2005,
  licenseNumber: 'LIC-001',
  coreValues: [{ title_ar: 'الكرامة', title_en: 'Dignity', body_ar: null, body_en: null }],
  primaryPhone: '+970591234567',
  officeHoursAr: 'الأحد إلى الخميس',
};

describe('organisation settings — who may change what', () => {
  beforeEach(async () => {
    await getDb().insert(organizationSettings).values(ORG_ROW);
  });

  it('lets a content manager save a contact change although the form posts every field', async () => {
    await updateOrganization(db(), MANAGER, {
      // Restricted fields, posted unchanged because the settings form is one
      // form and always sends them.
      legalNameAr: ORG_ROW.legalNameAr,
      licenseNumber: ORG_ROW.licenseNumber,
      foundedYear: ORG_ROW.foundedYear,
      coreValues: ORG_ROW.coreValues,
      // The one field actually being edited.
      officeHoursAr: 'الأحد إلى الأربعاء',
    });

    const stored = row1(await getDb().select().from(organizationSettings));
    expect(stored.officeHoursAr).toBe('الأحد إلى الأربعاء');
    expect(stored.licenseNumber).toBe('LIC-001');
  });

  it('does not treat a reordered jsonb block as a change', async () => {
    await updateOrganization(db(), MANAGER, {
      // Same value, different key order — what comes back from `jsonb` and
      // goes out again through a form. A `JSON.stringify` comparison called
      // this a change and refused the save.
      coreValues: [{ body_en: null, body_ar: null, title_en: 'Dignity', title_ar: 'الكرامة' }],
      primaryPhone: '+970599999999',
    });

    const stored = row1(await getDb().select().from(organizationSettings));
    expect(stored.primaryPhone).toBe('+970599999999');
  });

  it('refuses a content manager who actually changes a restricted field', async () => {
    await expect(
      updateOrganization(db(), MANAGER, { licenseNumber: 'LIC-002' }),
    ).rejects.toMatchObject({ code: 'forbidden' });

    const stored = row1(await getDb().select().from(organizationSettings));
    expect(stored.licenseNumber).toBe('LIC-001');
  });

  it('lets an admin change a restricted field', async () => {
    await updateOrganization(db(), ADMIN, { licenseNumber: 'LIC-002' });
    const stored = row1(await getDb().select().from(organizationSettings));
    expect(stored.licenseNumber).toBe('LIC-002');
  });

  it('refuses an editor outright', async () => {
    await expect(
      updateOrganization(db(), EDITOR, { officeHoursAr: 'كل يوم' }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });
});

// ── Vacancy posting date ─────────────────────────────────────────────────

describe('vacancy posted_at', () => {
  it('writes the posting date the form supplies', async () => {
    const { id } = await vacancyService.upsert(db(), MANAGER, {
      titleAr: 'منسّق حماية',
      deadline: '2026-12-31',
      postedAt: '2026-03-01',
    });

    const stored = row1(await getDb().select().from(vacancies).where(eq(vacancies.id, id)));
    expect(stored.postedAt).toBe('2026-03-01');
  });

  it('keeps the stored date when the field comes back blank', async () => {
    const { id } = await vacancyService.upsert(db(), MANAGER, {
      titleAr: 'منسّق حماية',
      deadline: '2026-12-31',
      postedAt: '2026-03-01',
    });

    await vacancyService.upsert(db(), MANAGER, {
      id,
      titleAr: 'منسّق حماية أول',
      deadline: '2026-12-31',
      // What an untouched `<input type="date">` posts.
      postedAt: '',
    });

    const stored = row1(await getDb().select().from(vacancies).where(eq(vacancies.id, id)));
    expect(stored.titleAr).toBe('منسّق حماية أول');
    expect(stored.postedAt).toBe('2026-03-01');
  });
});

// ── Post and story galleries ─────────────────────────────────────────────

describe('post and story galleries', () => {
  let mediaId: string;

  beforeEach(async () => {
    mediaId = row1(
      await getDb()
        .insert(mediaAssets)
        .values({ path: 'media/g.webp', mimeType: 'image/webp', fileSize: 10, altAr: 'صورة' })
        .returning({ id: mediaAssets.id }),
    ).id;
  });

  it('keeps a post gallery when `media` is absent and replaces it when it is posted', async () => {
    const { id } = await postService.upsert(db(), MANAGER, { titleAr: 'خبر' });
    await getDb().insert(postMedia).values({ postId: id, mediaId, displayOrder: 0 });

    await postService.upsert(db(), MANAGER, { id, titleAr: 'خبر محدّث' });
    expect(await getDb().select().from(postMedia).where(eq(postMedia.postId, id))).toHaveLength(1);

    await postService.upsert(db(), MANAGER, { id, titleAr: 'خبر محدّث', media: [] });
    expect(await getDb().select().from(postMedia).where(eq(postMedia.postId, id))).toHaveLength(0);

    const stored = row1(await getDb().select().from(posts).where(eq(posts.id, id)));
    expect(stored.titleAr).toBe('خبر محدّث');
  });

  it('keeps a story gallery when `media` is absent and replaces it when it is posted', async () => {
    const { id } = await storyService.upsert(db(), MANAGER, { titleAr: 'قصة' });
    await getDb().insert(storyMedia).values({ storyId: id, mediaId, displayOrder: 0 });

    await storyService.upsert(db(), MANAGER, { id, titleAr: 'قصة محدّثة' });
    expect(await getDb().select().from(storyMedia).where(eq(storyMedia.storyId, id))).toHaveLength(1);

    await storyService.upsert(db(), MANAGER, { id, titleAr: 'قصة محدّثة', media: [] });
    expect(await getDb().select().from(storyMedia).where(eq(storyMedia.storyId, id))).toHaveLength(0);

    const stored = row1(await getDb().select().from(stories).where(eq(stories.id, id)));
    expect(stored.titleAr).toBe('قصة محدّثة');
  });
});
