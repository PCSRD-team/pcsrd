import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import {
  applicationForms,
  applications,
  auditLogs,
  profiles,
  type ApplicationFormField,
} from '@/db/schema';
import type { Actor } from '@/services/_shared/actor';
import {
  createForm,
  deleteField,
  getForm,
  reorderFields,
  saveField,
  setFormStatus,
  updateForm,
} from '@/services/applications/application-form.service';
import {
  admitFromWaitlist,
  buildExportTable,
  deleteApplication,
  getApplication,
  resolveAttachment,
  submitApplication,
} from '@/services/applications/application.service';
import { type VacancyInput, vacancyService } from '@/services/content';
import type {
  ApplicationFieldInput,
  ApplicationFormInput,
} from '@/lib/validation/applications';
import { resetTables, useTestDb } from '../setup/pglite';
import { row1 } from '../setup/rows';

/**
 * The careers portal's second review: the rules that stop sensitive answers
 * leaking through the builder, retention that follows the form, the races on
 * the waiting list, and a vacancy that carries its form with it.
 *
 * Service rules only, as in `applications.test.ts` — PGlite connects as
 * `postgres` and the row-level policies do not bite here.
 */

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

async function publishedForm(overrides: Partial<ApplicationFormInput> = {}) {
  const form = await createForm(db(), ADMIN, formInput(overrides), ['full_name_ar', 'email']);
  return setFormStatus(db(), ADMIN, form.id, 'published');
}

const apply = (formId: string, email: string, answers: Record<string, unknown> = {}) =>
  submitApplication(db(), {
    formId,
    locale: 'ar',
    answers: { email, ...answers },
    attachments: [],
    applicantName: null,
    applicantEmail: email,
    applicantPhone: null,
  });

const countOf = async (formId: string) =>
  row1(await getDb().select().from(applicationForms).where(eq(applicationForms.id, formId)))
    .submissionCount;

const auditFor = (entityId: string) =>
  getDb().select().from(auditLogs).where(eq(auditLogs.entityId, entityId));

describe('sensitive data cannot be exposed through the builder', () => {
  async function formWithIdAndApplicant() {
    const form = await createForm(db(), ADMIN, formInput(), ['full_name_ar', 'national_id']);
    await setFormStatus(db(), ADMIN, form.id, 'published');
    const created = await apply(form.id, 'sara@example.ps', {
      full_name_ar: 'سارة',
      national_id: '400123456',
    });
    const idField = form.fields.find((field) => field.key === 'national_id')!;
    return { form, created, idField };
  }

  const asInput = (field: ApplicationFormField, overrides: Partial<ApplicationFieldInput> = {}) =>
    ({
      id: field.id,
      key: field.key,
      type: field.type,
      sortOrder: field.sortOrder,
      labelAr: field.labelAr,
      labelEn: field.labelEn,
      required: field.required,
      sensitive: field.sensitive,
      options: field.options,
      config: {},
      visibleWhen: null,
      ...overrides,
    }) as ApplicationFieldInput;

  it('refuses unflagging a sensitive field without applications.sensitive', async () => {
    const { form, idField } = await formWithIdAndApplicant();
    await expect(
      saveField(db(), MANAGER, form.id, asInput(idField, { sensitive: false })),
    ).rejects.toMatchObject({ code: 'forbidden' });

    const saved = await saveField(db(), ADMIN, form.id, asInput(idField, { sensitive: false }));
    expect(saved.sensitive).toBe(false);
  });

  it('refuses deleting a sensitive field without applications.sensitive', async () => {
    const { form, idField } = await formWithIdAndApplicant();
    await expect(deleteField(db(), MANAGER, form.id, idField.id)).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('keeps an orphaned answer redacted, on screen and in the export, once its field is gone', async () => {
    const { form, created, idField } = await formWithIdAndApplicant();
    await deleteField(db(), ADMIN, form.id, idField.id);

    const detail = await getApplication(db(), MANAGER, created.id);
    expect(detail.answers).not.toHaveProperty('national_id');
    expect(detail.redactedKeys).toContain('national_id');
    expect(detail.answers).toMatchObject({ full_name_ar: 'سارة' });

    const table = await buildExportTable(db(), MANAGER, form.id);
    expect(table.columns.map((column) => column.key)).not.toContain('national_id');
    expect(table.rows[0]).not.toHaveProperty('national_id');
  });

  it('does not redact the synthetic consent tick, which has no field row by design', async () => {
    const form = await publishedForm();
    const created = await apply(form.id, 'sara@example.ps', {
      full_name_ar: 'سارة',
      data_processing_consent: true,
    });
    const detail = await getApplication(db(), MANAGER, created.id);
    expect(detail.redactedKeys).toEqual([]);
    expect(detail.answers).toMatchObject({ data_processing_consent: true });
  });

  it('refuses the download of a file whose field no longer exists without the capability', async () => {
    const form = await publishedForm();
    const created = await submitApplication(db(), {
      formId: form.id,
      locale: 'ar',
      answers: { email: 'sara@example.ps' },
      attachments: [
        {
          fieldKey: 'id_copy_gone',
          path: 'application/id_copy_gone/abc.pdf',
          originalName: 'id.pdf',
          size: 10,
          mime: 'application/pdf',
        },
      ],
      applicantName: null,
      applicantEmail: 'sara@example.ps',
      applicantPhone: null,
    });
    await expect(
      resolveAttachment(db(), MANAGER, created.id, 'application/id_copy_gone/abc.pdf'),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('lets an editor retitle a form but not change how applicants’ data is handled', async () => {
    const form = await createForm(db(), ADMIN, formInput(), ['full_name_ar']);

    await expect(
      updateForm(db(), EDITOR, form.id, formInput({ titleAr: 'عنوان جديد' })),
    ).resolves.toMatchObject({ titleAr: 'عنوان جديد' });

    const changes: Partial<ApplicationFormInput>[] = [
      { retentionMonths: 6 },
      { notifyEmails: ['someone@example.org'] },
      { requireConsent: false },
    ];
    for (const change of changes) {
      await expect(updateForm(db(), EDITOR, form.id, formInput(change))).rejects.toMatchObject({
        code: 'forbidden',
      });
    }

    // A manager handles submissions, so may.
    await expect(
      updateForm(db(), MANAGER, form.id, formInput({ retentionMonths: 6 })),
    ).resolves.toMatchObject({ retentionMonths: 6 });
  });
});

describe('retention follows the form', () => {
  it('recomputes the deadline of applications already stored, and audits how many moved', async () => {
    const form = await publishedForm({ retentionMonths: 24 });
    const created = await apply(form.id, 'sara@example.ps');

    await updateForm(db(), MANAGER, form.id, formInput({ retentionMonths: 3 }));

    const { rows } = await getDb().execute(
      `select to_char(purge_after, 'YYYY-MM-DD') as actual,
              to_char((created_at + make_interval(months => 3))::date, 'YYYY-MM-DD') as expected
         from applications where id = '${created.id}'`,
    );
    const [check] = rows as { actual: string; expected: string }[];
    expect(check!.actual).toBe(check!.expected);

    const entries = await auditFor(form.id);
    const update = entries.find((entry) =>
      JSON.stringify(entry.diff ?? {}).includes('applicationsRetimed'),
    );
    expect(update).toBeDefined();
  });

  it('leaves stored deadlines alone when retention does not change', async () => {
    const form = await publishedForm({ retentionMonths: 24 });
    const created = await apply(form.id, 'sara@example.ps');
    const before = row1(
      await getDb().select().from(applications).where(eq(applications.id, created.id)),
    ).purgeAfter;

    await updateForm(db(), MANAGER, form.id, formInput({ retentionMonths: 24, titleAr: 'آخر' }));

    const after = row1(
      await getDb().select().from(applications).where(eq(applications.id, created.id)),
    ).purgeAfter;
    expect(String(after)).toBe(String(before));
  });
});

describe('status changes are recorded as what they are', () => {
  const emailVacancy: VacancyInput = {
    titleAr: 'منسق ميداني',
    slugAr: 'منسق',
    slugEn: 'coordinator',
    deadline: '2030-08-01',
    status: 'draft',
    applicationMethod: 'email',
    applicationEmail: 'jobs@example.org',
  };

  it('audits archiving a form as archive, not unpublish', async () => {
    const form = await publishedForm();
    await setFormStatus(db(), ADMIN, form.id, 'archived');
    expect((await auditFor(form.id)).map((entry) => entry.action)).toContain('archive');
  });

  it('writes nothing for a status change to the status a record already has', async () => {
    const created = await vacancyService.upsert(db(), ADMIN, emailVacancy);
    const before = await auditFor(created.id);
    await vacancyService.setStatus(db(), ADMIN, created.id, 'draft');
    expect(await auditFor(created.id)).toHaveLength(before.length);
  });

  it('refuses a same-status request from an actor with no write access', async () => {
    const created = await vacancyService.upsert(db(), ADMIN, emailVacancy);
    await expect(
      vacancyService.setStatus(db(), { ...EDITOR, isActive: false }, created.id, 'draft'),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('a vacancy and its form move together', () => {
  const vacancyInput = (overrides: Partial<VacancyInput> = {}): VacancyInput => ({
    titleAr: 'منسق ميداني',
    titleEn: 'Field officer',
    slugAr: 'منسق-ميداني',
    slugEn: 'field-officer',
    type: 'job',
    deadline: '2030-08-01',
    status: 'published',
    applicationMethod: 'form',
    ...overrides,
  });

  const formOf = async (vacancyId: string) =>
    row1(
      await getDb().select().from(applicationForms).where(eq(applicationForms.vacancyId, vacancyId)),
    );

  it('creates the draft form in the vacancy’s own write', async () => {
    const vacancy = await vacancyService.upsert(db(), ADMIN, vacancyInput());
    const form = await formOf(vacancy.id);
    expect(form.status).toBe('draft');
    // The end of the vacancy's last day in Gaza (UTC+3 in August).
    expect(form.closesAt?.toISOString()).toBe('2030-08-01T20:59:00.000Z');
  });

  it('moves the form’s deadline when the vacancy’s moves', async () => {
    const vacancy = await vacancyService.upsert(db(), ADMIN, vacancyInput());
    await vacancyService.upsert(
      db(),
      ADMIN,
      vacancyInput({ id: vacancy.id, deadline: '2030-09-15' }),
    );
    expect((await formOf(vacancy.id)).closesAt?.toISOString()).toBe('2030-09-15T20:59:00.000Z');
  });

  it('takes a published form down with the vacancy, and archives it with the vacancy', async () => {
    const vacancy = await vacancyService.upsert(db(), ADMIN, vacancyInput());
    const form = await formOf(vacancy.id);
    await setFormStatus(db(), ADMIN, form.id, 'published');

    await vacancyService.setStatus(db(), ADMIN, vacancy.id, 'draft');
    expect((await formOf(vacancy.id)).status).toBe('draft');

    await vacancyService.setStatus(db(), ADMIN, vacancy.id, 'published');
    await setFormStatus(db(), ADMIN, form.id, 'published');
    await vacancyService.setStatus(db(), ADMIN, vacancy.id, 'archived');
    expect((await formOf(vacancy.id)).status).toBe('archived');
  });

  it('takes the form down when the vacancy is unpublished through its edit form', async () => {
    const vacancy = await vacancyService.upsert(db(), ADMIN, vacancyInput());
    const form = await formOf(vacancy.id);
    await setFormStatus(db(), ADMIN, form.id, 'published');

    await vacancyService.upsert(db(), ADMIN, vacancyInput({ id: vacancy.id, status: 'draft' }));
    expect((await formOf(vacancy.id)).status).toBe('draft');
  });

  it('creates no form for a vacancy that takes applications by email', async () => {
    const vacancy = await vacancyService.upsert(
      db(),
      ADMIN,
      vacancyInput({ applicationMethod: 'email', applicationEmail: 'jobs@example.org' }),
    );
    const rows = await getDb()
      .select()
      .from(applicationForms)
      .where(eq(applicationForms.vacancyId, vacancy.id));
    expect(rows).toHaveLength(0);
  });
});

describe('races on the waiting list and erasure', () => {
  it('admits once when two admissions race, and counts the place once', async () => {
    const form = await publishedForm({ capacity: 1, capacityRule: 'waitlist' });
    await apply(form.id, 'a@example.ps');
    const waiting = await apply(form.id, 'b@example.ps');

    const results = await Promise.allSettled([
      admitFromWaitlist(db(), MANAGER, waiting.id),
      admitFromWaitlist(db(), MANAGER, waiting.id),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await countOf(form.id)).toBe(2);
  });

  it('refuses a second erasure rather than giving the place back twice', async () => {
    const form = await publishedForm({ capacity: 5 });
    const first = await apply(form.id, 'a@example.ps');
    await apply(form.id, 'b@example.ps');

    await deleteApplication(db(), ADMIN, first.id);
    await expect(deleteApplication(db(), ADMIN, first.id)).rejects.toMatchObject({
      code: 'not_found',
    });
    expect(await countOf(form.id)).toBe(1);
  });
});

describe('reordering in one statement', () => {
  it('renumbers every field in tens, in the order given', async () => {
    const form = await createForm(db(), ADMIN, formInput(), ['full_name_ar', 'email', 'cv_file']);
    const [a, b, c] = form.fields;
    await reorderFields(db(), ADMIN, form.id, [c!.id, a!.id, b!.id]);

    const reread = await getForm(db(), ADMIN, form.id);
    expect(reread.fields.map((field) => [field.key, field.sortOrder])).toEqual([
      [c!.key, 0],
      [a!.key, 10],
      [b!.key, 20],
    ]);
  });
});
