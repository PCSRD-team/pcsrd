import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import { applicationForms, applications, profiles } from '@/db/schema';
import { AppError } from '@/lib/errors';
import type { Actor } from '@/services/_shared/actor';
import {
  addCatalogFieldToForm,
  createForm,
  deleteField,
  isFormOpen,
  reorderFields,
  saveField,
  setFormStatus,
  updateForm,
} from '@/services/applications/application-form.service';
import {
  buildExportTable,
  getApplication,
  listApplicants,
  purgeExpiredApplications,
  reviewApplication,
  submitApplication,
} from '@/services/applications/application.service';
import { parseAnswers } from '@/lib/applications/answer-schema';
import type { ApplicationFormInput } from '@/lib/validation/applications';
import { resetTables, useTestDb } from '../setup/pglite';
import { row1 } from '../setup/rows';

/**
 * The careers portal's service rules.
 *
 * **These tests exercise the service layer, not the row-level policies.**
 * PGlite connects as `postgres`, which matches `pcsrd_owner_all` on all four
 * tables, so every policy here is satisfied by the connection rather than by
 * the actor. That is the same limitation the rest of this suite carries and it
 * is stated in `tests/setup/pglite.ts`; verifying RLS needs the real database
 * (`scripts/assert-rls.ts`).
 *
 * What *is* real here: the CHECK constraints, the triggers, the unique indexes,
 * and — most importantly — `app.submit_application()`, which is where the
 * window, the cap and the duplicate rule actually live.
 */

const getDb = useTestDb();
/** The service signature asks for the app `Db`; PGlite's handle is structurally
 *  the same Drizzle instance over a different driver. */
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

const formInput = (overrides: Partial<ApplicationFormInput> = {}): ApplicationFormInput =>
  ({
    kind: 'job',
    slug: 'field-officer',
    titleAr: 'منسق ميداني',
    titleEn: null,
    introAr: null,
    introEn: null,
    status: 'draft',
    opensAt: null,
    closesAt: null,
    capacity: null,
    capacityRule: 'close',
    confirmationAr: null,
    confirmationEn: null,
    notifyEmails: [],
    retentionMonths: 12,
    allowMultiplePerEmail: false,
    requireConsent: true,
    vacancyId: null,
    ...overrides,
  }) as ApplicationFormInput;

beforeEach(async () => {
  await resetTables(getDb());
  await getDb()
    .insert(profiles)
    .values([
      { id: ADMIN.id, email: 'admin@example.org', fullName: 'Admin', role: 'admin' },
      { id: MANAGER.id, email: 'manager@example.org', fullName: 'Manager', role: 'content_manager' },
      { id: EDITOR.id, email: 'editor@example.org', fullName: 'Editor', role: 'editor' },
    ]);
});

/** Publishes a form with one simple text field, which is the minimum that publishes. */
async function publishedForm(overrides: Partial<ApplicationFormInput> = {}) {
  const form = await createForm(db(), ADMIN, formInput(overrides), ['full_name_ar', 'email']);
  return setFormStatus(db(), ADMIN, form.id, 'published');
}

describe('createForm', () => {
  it('seeds the starter fields in order and in tens', async () => {
    const form = await createForm(db(), ADMIN, formInput(), ['full_name_ar', 'email', 'cv_file']);

    expect(form.fields.map((field) => field.key)).toEqual(['full_name_ar', 'email', 'cv_file']);
    expect(form.fields.map((field) => field.sortOrder)).toEqual([0, 10, 20]);
    // Catalogue provenance is recorded, which is what lets the service tell a
    // vetted field from a hand-built one later.
    expect(form.fields.every((field) => field.catalogKey !== null)).toBe(true);
  });

  it('refuses a duplicate slug with a field error rather than a constraint violation', async () => {
    await createForm(db(), ADMIN, formInput());
    await expect(createForm(db(), ADMIN, formInput({ titleAr: 'آخر' }))).rejects.toMatchObject({
      code: 'conflict',
      fieldErrors: { slug: ['errors.slug.taken'] },
    });
  });

  it('refuses an editor, who may write content but not run a recruitment', async () => {
    await expect(createForm(db(), EDITOR, formInput({ status: 'published' }))).rejects.toBeInstanceOf(
      AppError,
    );
  });
});

describe('setFormStatus', () => {
  it('refuses to publish a form with no answerable fields', async () => {
    const form = await createForm(db(), ADMIN, formInput(), ['section_personal']);
    await expect(setFormStatus(db(), ADMIN, form.id, 'published')).rejects.toMatchObject({
      message: 'errors.applicationForm.noFields',
    });
  });

  it('refuses to publish a sensitive field without a consent tick', async () => {
    const form = await createForm(db(), ADMIN, formInput({ requireConsent: false }), [
      'full_name_ar',
      'national_id',
    ]);

    await expect(setFormStatus(db(), ADMIN, form.id, 'published')).rejects.toMatchObject({
      code: 'consent_required',
    });
  });

  it('refuses to publish a deadline that has already passed', async () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const form = await createForm(db(), ADMIN, formInput({ closesAt: past }), ['full_name_ar']);

    await expect(setFormStatus(db(), ADMIN, form.id, 'published')).rejects.toMatchObject({
      message: 'errors.applicationForm.deadlinePassed',
    });
  });
});

describe('fields', () => {
  it('refuses the same catalogue field twice', async () => {
    const form = await createForm(db(), ADMIN, formInput(), ['full_name_ar']);
    await expect(addCatalogFieldToForm(db(), ADMIN, form.id, 'full_name_ar')).rejects.toMatchObject(
      { code: 'conflict' },
    );
  });

  it('freezes a field key once an application exists, but not its label', async () => {
    const form = await publishedForm();
    await submitApplication(db(), {
      formId: form.id,
      locale: 'ar',
      answers: { full_name_ar: 'محمد أحمد', email: 'a@example.ps' },
      attachments: [],
      applicantName: 'محمد أحمد',
      applicantEmail: 'a@example.ps',
      applicantPhone: null,
    });

    const field = row1(form.fields.filter((f) => f.key === 'full_name_ar'));

    await expect(
      saveField(db(), ADMIN, form.id, {
        id: field.id,
        key: 'renamed_key',
        type: field.type,
        labelAr: field.labelAr,
        labelEn: null,
        placeholderAr: null,
        placeholderEn: null,
        helpAr: null,
        helpEn: null,
        required: true,
        sensitive: false,
        sortOrder: field.sortOrder,
        options: [],
        config: {},
        visibleWhen: null,
      }),
    ).rejects.toMatchObject({ message: 'errors.applicationForm.keyFrozen' });

    // The label is editable forever — which is what an admin usually means by
    // "rename this field".
    const saved = await saveField(db(), ADMIN, form.id, {
      id: field.id,
      key: field.key,
      type: field.type,
      labelAr: 'الاسم الكامل',
      labelEn: null,
      placeholderAr: null,
      placeholderEn: null,
      helpAr: null,
      helpEn: null,
      required: true,
      sensitive: false,
      sortOrder: field.sortOrder,
      options: [],
      config: {},
      visibleWhen: null,
    });
    expect(saved.labelAr).toBe('الاسم الكامل');
  });

  it('keeps a catalogue pattern when the field is saved through the editor', async () => {
    const form = await createForm(db(), ADMIN, formInput(), ['national_id']);
    const field = row1(form.fields);
    expect(field.config.pattern).toBeTruthy();

    // The editor posts no `pattern` — the schema has no such key — so without
    // the carry-over in `saveField` the ID check would silently disappear.
    const saved = await saveField(db(), ADMIN, form.id, {
      id: field.id,
      key: field.key,
      type: field.type,
      labelAr: 'رقم الهوية',
      labelEn: null,
      placeholderAr: null,
      placeholderEn: null,
      helpAr: null,
      helpEn: null,
      required: true,
      sensitive: true,
      sortOrder: field.sortOrder,
      options: [],
      config: {},
      visibleWhen: null,
    });

    expect(saved.config.pattern).toBe(field.config.pattern);
    // The marker survives the edit because the rule it promises survived it.
    expect(saved.catalogKey).toBe('national_id');
  });

  it('refuses a condition that points forwards', async () => {
    const form = await createForm(db(), ADMIN, formInput(), ['full_name_ar', 'email']);
    const email = row1(form.fields.filter((f) => f.key === 'email'));

    await expect(
      saveField(db(), ADMIN, form.id, {
        id: null,
        key: 'why_you',
        type: 'long_text',
        labelAr: 'لماذا أنت مناسب؟',
        labelEn: null,
        placeholderAr: null,
        placeholderEn: null,
        helpAr: null,
        helpEn: null,
        required: false,
        sensitive: false,
        // Placed *before* the field it depends on.
        sortOrder: email.sortOrder - 5,
        options: [],
        config: {},
        visibleWhen: { field: 'email', equals: ['x'] },
      }),
    ).rejects.toMatchObject({ message: 'errors.applicationForm.conditionForwards' });
  });

  it('refuses to delete a field another field depends on', async () => {
    const form = await createForm(db(), ADMIN, formInput(), ['full_name_ar', 'email']);
    const email = row1(form.fields.filter((f) => f.key === 'email'));

    await saveField(db(), ADMIN, form.id, {
      id: null,
      key: 'follow_up',
      type: 'short_text',
      labelAr: 'تفاصيل',
      labelEn: null,
      placeholderAr: null,
      placeholderEn: null,
      helpAr: null,
      helpEn: null,
      required: false,
      sensitive: false,
      sortOrder: email.sortOrder + 5,
      options: [],
      config: {},
      visibleWhen: { field: 'email', equals: ['yes'] },
    });

    await expect(deleteField(db(), ADMIN, form.id, email.id)).rejects.toMatchObject({
      message: 'errors.applicationForm.fieldHasDependents',
    });
  });

  it('refuses a reorder that would move a field before the one it depends on', async () => {
    const form = await createForm(db(), ADMIN, formInput(), ['full_name_ar', 'email']);
    const email = row1(form.fields.filter((f) => f.key === 'email'));

    const dependent = await saveField(db(), ADMIN, form.id, {
      id: null,
      key: 'follow_up',
      type: 'short_text',
      labelAr: 'تفاصيل',
      labelEn: null,
      placeholderAr: null,
      placeholderEn: null,
      helpAr: null,
      helpEn: null,
      required: false,
      sensitive: false,
      sortOrder: email.sortOrder + 5,
      options: [],
      config: {},
      visibleWhen: { field: 'email', equals: ['yes'] },
    });

    const name = row1(form.fields.filter((f) => f.key === 'full_name_ar'));

    await expect(
      reorderFields(db(), ADMIN, form.id, [dependent.id, name.id, email.id]),
    ).rejects.toMatchObject({ message: 'errors.applicationForm.conditionForwards' });
  });
});

describe('app.submit_application', () => {
  it('stores an application, hashes the address and sets retention from the form', async () => {
    const form = await publishedForm({ retentionMonths: 24 });

    const created = await submitApplication(db(), {
      formId: form.id,
      locale: 'ar',
      answers: { full_name_ar: 'سارة خليل', email: 'sara@example.ps' },
      attachments: [],
      applicantName: 'سارة خليل',
      applicantEmail: 'sara@example.ps',
      applicantPhone: null,
      ip: '203.0.113.9',
      userAgent: 'Mozilla/5.0',
    });

    expect(created.reference).toMatch(/^PCS-APP-[0-9A-F]{8}$/);
    expect(created.waitlisted).toBe(false);

    const row = row1(
      await getDb().select().from(applications).where(eq(applications.formId, form.id)),
    );

    expect(row.ipHash).not.toBe('203.0.113.9');
    expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.answers).toMatchObject({ full_name_ar: 'سارة خليل' });

    // Two years out, from the form's own `retentionMonths` — not a global default.
    const expected = new Date();
    expected.setMonth(expected.getMonth() + 24);
    expect(created.purgeAfter.slice(0, 7)).toBe(expected.toISOString().slice(0, 7));
  });

  it('enforces the cap atomically and counts only the slots taken', async () => {
    const form = await publishedForm({ capacity: 2 });

    const apply = (email: string) =>
      submitApplication(db(), {
        formId: form.id,
        locale: 'ar',
        answers: { email },
        attachments: [],
        applicantName: null,
        applicantEmail: email,
        applicantPhone: null,
      });

    await apply('a@example.ps');
    await apply('b@example.ps');

    await expect(apply('c@example.ps')).rejects.toMatchObject({
      message: 'errors.apply.full',
    });

    const stored = row1(
      await getDb().select().from(applicationForms).where(eq(applicationForms.id, form.id)),
    );
    expect(stored.submissionCount).toBe(2);
  });

  it('waitlists past the cap without incrementing the counter', async () => {
    const form = await publishedForm({ capacity: 1, capacityRule: 'waitlist' });

    const apply = (email: string) =>
      submitApplication(db(), {
        formId: form.id,
        locale: 'ar',
        answers: { email },
        attachments: [],
        applicantName: null,
        applicantEmail: email,
        applicantPhone: null,
      });

    expect((await apply('a@example.ps')).waitlisted).toBe(false);
    expect((await apply('b@example.ps')).waitlisted).toBe(true);

    const stored = row1(
      await getDb().select().from(applicationForms).where(eq(applicationForms.id, form.id)),
    );
    // Slots taken, not applications received — which is what makes raising the
    // capacity later admit the people on the list.
    expect(stored.submissionCount).toBe(1);
  });

  it('refuses a second application from the same address, case-insensitively', async () => {
    const form = await publishedForm();

    const apply = (email: string) =>
      submitApplication(db(), {
        formId: form.id,
        locale: 'ar',
        answers: { email },
        attachments: [],
        applicantName: null,
        applicantEmail: email,
        applicantPhone: null,
      });

    await apply('Sara@Example.PS');
    await expect(apply('sara@example.ps')).rejects.toMatchObject({
      message: 'errors.apply.duplicate',
    });
  });

  it('allows a repeat application when the form says so', async () => {
    const form = await publishedForm({ allowMultiplePerEmail: true });

    const apply = () =>
      submitApplication(db(), {
        formId: form.id,
        locale: 'ar',
        answers: { email: 'sara@example.ps' },
        attachments: [],
        applicantName: null,
        applicantEmail: 'sara@example.ps',
        applicantPhone: null,
      });

    await apply();
    await expect(apply()).resolves.toMatchObject({ waitlisted: false });
  });

  it('refuses a draft, a closed window and a window that has not opened', async () => {
    const draft = await createForm(db(), ADMIN, formInput({ slug: 'draft-form' }), ['email']);
    const apply = (formId: string) =>
      submitApplication(db(), {
        formId,
        locale: 'ar',
        answers: {},
        attachments: [],
        applicantName: null,
        applicantEmail: null,
        applicantPhone: null,
      });

    await expect(apply(draft.id)).rejects.toMatchObject({ message: 'errors.apply.closed' });

    const open = await publishedForm({ slug: 'open-form' });
    // Moved into the past *after* publishing, which the publish gate refuses
    // but an editor can still do with a later edit.
    await updateForm(
      db(),
      ADMIN,
      open.id,
      formInput({ slug: 'open-form', closesAt: new Date(Date.now() - 3600_000).toISOString() }),
    );
    await expect(apply(open.id)).rejects.toMatchObject({ message: 'errors.apply.closed' });

    const later = await publishedForm({ slug: 'later-form' });
    await updateForm(
      db(),
      ADMIN,
      later.id,
      formInput({ slug: 'later-form', opensAt: new Date(Date.now() + 3600_000).toISOString() }),
    );
    await expect(apply(later.id)).rejects.toMatchObject({ message: 'errors.apply.notYetOpen' });
  });

  it('records the arrival in the applicant history', async () => {
    const form = await publishedForm();
    const created = await submitApplication(db(), {
      formId: form.id,
      locale: 'ar',
      answers: { email: 'a@example.ps' },
      attachments: [],
      applicantName: null,
      applicantEmail: 'a@example.ps',
      applicantPhone: null,
    });

    const detail = await getApplication(db(), ADMIN, created.id);
    expect(detail.events).toHaveLength(1);
    expect(detail.events[0]).toMatchObject({ fromStatus: null, toStatus: 'new' });
  });
});

describe('the pipeline', () => {
  it('records a status change and sets reviewedAt, keeping the first timestamp', async () => {
    const form = await publishedForm();
    const created = await submitApplication(db(), {
      formId: form.id,
      locale: 'ar',
      answers: { email: 'a@example.ps' },
      attachments: [],
      applicantName: null,
      applicantEmail: 'a@example.ps',
      applicantPhone: null,
    });

    const first = await reviewApplication(db(), MANAGER, created.id, {
      status: 'under_review',
      rating: 4,
      internalNote: 'مؤهل جيد',
    });
    expect(first.reviewedAt).not.toBeNull();

    const second = await reviewApplication(db(), MANAGER, created.id, {
      status: 'shortlisted',
      rating: 5,
      internalNote: null,
    });
    // "When was this first looked at" is the useful question; the audit log
    // already answers "when was it last touched".
    expect(second.reviewedAt?.getTime()).toBe(first.reviewedAt?.getTime());

    const detail = await getApplication(db(), MANAGER, created.id);
    // Arrival, plus the two status changes.
    expect(detail.events.map((event) => event.toStatus)).toEqual([
      'new',
      'under_review',
      'shortlisted',
    ]);
  });

  it('does not write a history entry for a note that changed no status', async () => {
    const form = await publishedForm();
    const created = await submitApplication(db(), {
      formId: form.id,
      locale: 'ar',
      answers: { email: 'a@example.ps' },
      attachments: [],
      applicantName: null,
      applicantEmail: 'a@example.ps',
      applicantPhone: null,
    });

    await reviewApplication(db(), MANAGER, created.id, {
      status: 'new',
      rating: null,
      internalNote: 'ملاحظة',
    });

    const detail = await getApplication(db(), MANAGER, created.id);
    expect(detail.events).toHaveLength(1);
  });

  it('refuses an editor, who may not read a stranger’s application', async () => {
    const form = await publishedForm();
    await expect(listApplicants(db(), EDITOR, form.id)).rejects.toBeInstanceOf(AppError);
  });

  it('counts every status for the filter chips, unaffected by the filter', async () => {
    const form = await publishedForm({ allowMultiplePerEmail: true });
    for (const email of ['a@example.ps', 'b@example.ps', 'c@example.ps']) {
      await submitApplication(db(), {
        formId: form.id,
        locale: 'ar',
        answers: { email },
        attachments: [],
        applicantName: null,
        applicantEmail: email,
        applicantPhone: null,
      });
    }

    const all = await listApplicants(db(), MANAGER, form.id);
    const first = row1(all.rows);
    await reviewApplication(db(), MANAGER, first.id, {
      status: 'rejected',
      rating: null,
      internalNote: null,
    });

    const filtered = await listApplicants(db(), MANAGER, form.id, { status: 'rejected' });
    expect(filtered.rows).toHaveLength(1);
    // The chips still show what is in every other state while one is selected.
    expect(filtered.statusCounts).toMatchObject({ new: 2, rejected: 1 });
  });
});

describe('the export', () => {
  it('leaves sensitive columns out unless asked, and keeps orphaned answers', async () => {
    const form = await createForm(db(), ADMIN, formInput(), ['full_name_ar', 'national_id']);
    await setFormStatus(db(), ADMIN, form.id, 'published');

    await submitApplication(db(), {
      formId: form.id,
      locale: 'ar',
      answers: { full_name_ar: 'سارة', national_id: '400123456', removed_field: 'قيمة قديمة' },
      attachments: [],
      applicantName: 'سارة',
      applicantEmail: 'sara@example.ps',
      applicantPhone: null,
    });

    const plain = await buildExportTable(db(), MANAGER, form.id);
    const plainKeys = plain.columns.map((column) => column.key);
    expect(plainKeys).toContain('full_name_ar');
    expect(plainKeys).not.toContain('national_id');
    // A key the form no longer declares still has a column: the applicant did
    // answer it, and the spreadsheet must not disagree with the screen.
    expect(plainKeys).toContain('removed_field');

    const full = await buildExportTable(db(), MANAGER, form.id, { includeSensitive: true });
    expect(full.columns.map((column) => column.key)).toContain('national_id');
  });
});

describe('retention', () => {
  it('purges expired applications and returns their attachment paths', async () => {
    const form = await publishedForm();
    await submitApplication(db(), {
      formId: form.id,
      locale: 'ar',
      answers: { email: 'a@example.ps' },
      attachments: [
        {
          fieldKey: 'cv_file',
          path: 'application/cv_file/abc.pdf',
          originalName: 'cv.pdf',
          size: 1024,
          mime: 'application/pdf',
        },
      ],
      applicantName: null,
      applicantEmail: 'a@example.ps',
      applicantPhone: null,
    });

    // Nothing is due yet.
    expect((await purgeExpiredApplications(db())).deleted).toBe(0);

    await getDb().execute(`update applications set purge_after = current_date - 1`);

    const purged = await purgeExpiredApplications(db());
    expect(purged.deleted).toBe(1);
    // The path is returned so the caller can delete the object. A row deleted
    // without its CV is a retention policy that deleted the index, not the data.
    expect(purged.attachments).toEqual(['application/cv_file/abc.pdf']);
  });

  it('counts rows that carried no attachment', async () => {
    const form = await publishedForm({ allowMultiplePerEmail: true });
    for (const email of ['a@example.ps', 'b@example.ps']) {
      await submitApplication(db(), {
        formId: form.id,
        locale: 'ar',
        answers: { email },
        attachments: [],
        applicantName: null,
        applicantEmail: email,
        applicantPhone: null,
      });
    }

    await getDb().execute(`update applications set purge_after = current_date - 1`);

    const purged = await purgeExpiredApplications(db());
    // The lateral expansion over `attachments` contributes no row for these,
    // so a naive count would report zero.
    expect(purged.deleted).toBe(2);
    expect(purged.attachments).toEqual([]);
  });
});

describe('parseAnswers', () => {
  const field = (overrides: Record<string, unknown>) =>
    ({
      key: 'x',
      type: 'short_text',
      required: false,
      options: [],
      config: {},
      visibleWhen: null,
      sensitive: false,
      ...overrides,
    }) as Parameters<typeof parseAnswers>[0][number];

  it('drops a required field whose condition is unmet rather than refusing', async () => {
    const fields = [
      field({ key: 'has_relative', type: 'checkbox' }),
      field({
        key: 'relative_name',
        required: true,
        visibleWhen: { field: 'has_relative', equals: ['true'] },
      }),
    ];

    const result = parseAnswers(fields, { has_relative: '' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.answers).not.toHaveProperty('relative_name');
  });

  it('requires it once the condition is met', async () => {
    const fields = [
      field({ key: 'has_relative', type: 'checkbox' }),
      field({
        key: 'relative_name',
        required: true,
        visibleWhen: { field: 'has_relative', equals: ['true'] },
      }),
    ];

    const result = parseAnswers(fields, { has_relative: 'on' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.relative_name).toEqual(['errors.field.required']);
  });

  it('refuses a choice that is not on offer, so a crafted POST cannot invent one', async () => {
    const fields = [
      field({
        key: 'governorate',
        type: 'select',
        required: true,
        options: [{ value: 'gaza' }, { value: 'rafah' }],
      }),
    ];

    const result = parseAnswers(fields, { governorate: 'jerusalem' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.governorate).toEqual(['errors.field.invalidChoice']);
  });

  it('distinguishes an unticked required box from an unanswered one', async () => {
    const fields = [field({ key: 'agree', type: 'checkbox', required: true })];
    const result = parseAnswers(fields, { agree: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.agree).toEqual(['errors.field.mustAgree']);
  });

  it('drops a key the form does not declare instead of refusing the application', async () => {
    const fields = [field({ key: 'name' })];
    const result = parseAnswers(fields, { name: 'سارة', injected: 'x' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.answers).toEqual({ name: 'سارة' });
  });

  it('requires the synthetic consent tick when the form has no consent field', async () => {
    const fields = [field({ key: 'name' })];

    const refused = parseAnswers(fields, { name: 'سارة' }, { requireConsent: true });
    expect(refused.ok).toBe(false);

    const accepted = parseAnswers(
      fields,
      { name: 'سارة', data_processing_consent: 'on' },
      { requireConsent: true },
    );
    expect(accepted.ok).toBe(true);
    if (accepted.ok) expect(accepted.answers.data_processing_consent).toBe(true);
  });
});

describe('isFormOpen', () => {
  it('agrees with the database about every reason a form is shut', () => {
    const base = {
      status: 'published' as const,
      opensAt: null,
      closesAt: null,
      capacity: null,
      capacityRule: 'close' as const,
      submissionCount: 0,
    };

    expect(isFormOpen(base).open).toBe(true);
    expect(isFormOpen({ ...base, status: 'draft' })).toMatchObject({ reason: 'unpublished' });
    expect(
      isFormOpen({ ...base, opensAt: new Date(Date.now() + 1000) }),
    ).toMatchObject({ reason: 'not_yet' });
    expect(
      isFormOpen({ ...base, closesAt: new Date(Date.now() - 1000) }),
    ).toMatchObject({ reason: 'closed' });
    expect(isFormOpen({ ...base, capacity: 1, submissionCount: 1 })).toMatchObject({
      reason: 'full',
    });
    // A waitlist form past its cap is still taking names.
    expect(
      isFormOpen({ ...base, capacity: 1, submissionCount: 1, capacityRule: 'waitlist' }).open,
    ).toBe(true);
  });
});
