import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import type { Db, Tx } from '@/db';
import {
  applicationFormFields,
  applicationForms,
  applications,
  type ApplicationForm,
  type ApplicationFormField,
  type ApplicationFieldOption,
} from '@/db/schema';
import type { ContentStatus } from '@/db/schema/enums';
import { readAsActor, withActor } from '@/db/session';
import { catalogField } from '@/lib/applications/field-catalog';
import { AppError, conflict, forbidden, notFound } from '@/lib/errors';
import { slugify } from '../_shared/slug';
import type { Actor } from '../_shared/actor';
import { writeAudit } from '../_shared/audit';
import { computeDiff } from '../_shared/diff';
import { one } from '../_shared/one';
import { assertCan } from '../_shared/permissions';
import type {
  ApplicationFieldInput,
  ApplicationFormInput,
} from '@/lib/validation/applications';

/**
 * The form builder's rules.
 *
 * `src/db/queries/*` knows how to read; this knows what is allowed. Four rules
 * live here because none of them can be expressed as a column constraint:
 *
 * 1. **A key freezes once an application exists.** `applications.answers` is
 *    keyed by `application_form_fields.key`, so renaming a key after the first
 *    application orphans every answer already stored — the export loses a
 *    column and the reviewer loses an answer, silently. The label stays
 *    editable forever, which is what an admin actually wants when they "rename
 *    a field".
 *
 * 2. **A condition must point backwards.** `visibleWhen.field` has to name a
 *    field earlier in the order, which makes a cycle unrepresentable and lets
 *    the renderer and the validator both work in one forward pass.
 *
 * 3. **A sensitive field needs a consent tick.** A form that asks for a
 *    national ID or a date of birth without `requireConsent` cannot publish.
 *    `20-PRIVACY §5` prefers these were not asked at all; this is the floor
 *    beneath the decision to ask anyway.
 *
 * 4. **A published form needs somewhere to put an answer.** Publishing a form
 *    with no fields — or with only section headings — produces a page with a
 *    submit button and nothing above it.
 *
 * Nothing here imports from `next/*`. An ESLint rule scoped to
 * `src/services/**` enforces it, and it is what makes every function below
 * callable from an action, a route handler, a seed script or a test.
 */

// ── Reads ────────────────────────────────────────────────────────────────

export type FormWithFields = ApplicationForm & {
  fields: ApplicationFormField[];
  /** Live count, including the waitlisted rows `submissionCount` excludes. */
  applicationCount: number;
};

async function loadForm(tx: Tx, id: string): Promise<FormWithFields> {
  const form = one(
    await tx.select().from(applicationForms).where(eq(applicationForms.id, id)).limit(1),
    'application_form',
  );

  const [fields, [counted]] = await Promise.all([
    tx
      .select()
      .from(applicationFormFields)
      .where(eq(applicationFormFields.formId, id))
      .orderBy(asc(applicationFormFields.sortOrder), asc(applicationFormFields.key)),
    tx.select({ n: count() }).from(applications).where(eq(applications.formId, id)),
  ]);

  return { ...form, fields, applicationCount: counted?.n ?? 0 };
}

export async function getForm(db: Db, actor: Actor, id: string): Promise<FormWithFields> {
  assertCan(actor, 'content.read');
  return readAsActor(db, actor, (tx) => loadForm(tx, id));
}

// ── The form itself ──────────────────────────────────────────────────────

/**
 * A slug is unique across the whole table, so it is checked before the insert
 * rather than left to the unique index: a Postgres unique-violation message is
 * not something a form can render against the field that caused it.
 */
async function assertSlugFree(tx: Tx, slug: string, excludeId?: string): Promise<void> {
  const clash = excludeId
    ? and(eq(applicationForms.slug, slug), ne(applicationForms.id, excludeId))
    : eq(applicationForms.slug, slug);

  const [taken] = await tx
    .select({ id: applicationForms.id })
    .from(applicationForms)
    .where(clash)
    .limit(1);

  if (taken) throw conflict('errors.slug.taken', { slug: ['errors.slug.taken'] });
}

/** `''` from a `datetime-local` input means "no bound", not "the epoch". */
const toDate = (value: string | null | undefined): Date | null =>
  value ? new Date(value) : null;

function formColumns(input: ApplicationFormInput) {
  return {
    kind: input.kind,
    slug: slugify(input.slug),
    titleAr: input.titleAr,
    titleEn: input.titleEn || null,
    introAr: input.introAr ?? null,
    introEn: input.introEn ?? null,
    opensAt: toDate(input.opensAt),
    closesAt: toDate(input.closesAt),
    capacity: input.capacity,
    capacityRule: input.capacityRule,
    confirmationAr: input.confirmationAr || null,
    confirmationEn: input.confirmationEn || null,
    notifyEmails: input.notifyEmails,
    retentionMonths: input.retentionMonths,
    allowMultiplePerEmail: input.allowMultiplePerEmail,
    requireConsent: input.requireConsent,
    vacancyId: input.vacancyId || null,
  };
}

export async function createForm(
  db: Db,
  actor: Actor,
  input: ApplicationFormInput,
  /** Catalogue keys the new form starts with, in order. */
  starterFields: readonly string[] = [],
): Promise<FormWithFields> {
  assertCan(actor, 'content.write');
  if (input.status === 'published') assertCan(actor, 'content.publish');

  return withActor(db, actor, async (tx) => {
    const columns = formColumns(input);
    await assertSlugFree(tx, columns.slug);

    const form = one(
      await tx
        .insert(applicationForms)
        .values({
          ...columns,
          // A new form is a draft unless the actor may publish and asked to.
          status: input.status,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning(),
      'application_form',
    );

    // The starter set is written here rather than by the action so a form
    // created by a seed script or a test arrives usable. `sortOrder` counts in
    // tens, leaving room to insert between two fields without renumbering the
    // whole form.
    let order = 0;
    for (const key of starterFields) {
      const entry = catalogField(key);
      if (!entry) continue;
      await tx.insert(applicationFormFields).values(rowFromCatalog(form.id, entry, order));
      order += 10;
    }

    await writeAudit(tx, actor, {
      action: 'create',
      entityType: 'application_form',
      entityId: form.id,
      diff: computeDiff(null, form as unknown as Record<string, unknown>),
    });

    return loadForm(tx, form.id);
  });
}

export async function updateForm(
  db: Db,
  actor: Actor,
  id: string,
  input: ApplicationFormInput,
): Promise<FormWithFields> {
  assertCan(actor, 'content.write');

  return withActor(db, actor, async (tx) => {
    const before = one(
      await tx.select().from(applicationForms).where(eq(applicationForms.id, id)).limit(1),
      'application_form',
    );

    const columns = formColumns(input);
    await assertSlugFree(tx, columns.slug, id);

    // Shortening retention shortens the life of rows already stored, which is
    // the right behaviour — a decision to keep recruitment files for less time
    // should apply to the files that exist, not only to future ones. It is
    // also irreversible for anything the purge then removes, so it is recorded
    // in the audit diff like any other change rather than applied quietly.
    const after = one(
      await tx
        .update(applicationForms)
        .set({ ...columns, updatedBy: actor.id })
        .where(eq(applicationForms.id, id))
        .returning(),
      'application_form',
    );

    await writeAudit(tx, actor, {
      action: 'update',
      entityType: 'application_form',
      entityId: id,
      diff: computeDiff(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
      ),
    });

    return loadForm(tx, id);
  });
}

/**
 * The publish gate.
 *
 * Separate from `updateForm` because publishing is a different permission and
 * a different question: an update asks "is this well formed", a publish asks
 * "is this fit to put in front of an applicant". The three refusals below are
 * the second question, and none of them can be a column constraint — each one
 * needs to look at the form and its fields together.
 */
export async function setFormStatus(
  db: Db,
  actor: Actor,
  id: string,
  status: ContentStatus,
): Promise<FormWithFields> {
  assertCan(actor, 'content.publish');

  return withActor(db, actor, async (tx) => {
    const form = await loadForm(tx, id);

    if (status === 'published') {
      const answerable = form.fields.filter((field) => field.type !== 'section');
      if (answerable.length === 0) {
        throw new AppError('validation', 'errors.applicationForm.noFields');
      }

      if (!form.requireConsent && form.fields.some((field) => field.sensitive)) {
        throw new AppError('consent_required', 'errors.applicationForm.consentRequired', {
          meta: {
            sensitiveFields: form.fields.filter((f) => f.sensitive).map((f) => f.key),
          },
        });
      }

      // A deadline in the past publishes a form that is already closed: the
      // page renders, the applicant fills it in, and `app.submit_application`
      // refuses at the last step. Better to refuse here, to the person who can
      // fix it.
      if (form.closesAt && form.closesAt.getTime() <= Date.now()) {
        throw new AppError('validation', 'errors.applicationForm.deadlinePassed', {
          fieldErrors: { closesAt: ['errors.applicationForm.deadlinePassed'] },
        });
      }
    }

    const after = one(
      await tx
        .update(applicationForms)
        .set({ status, updatedBy: actor.id })
        .where(eq(applicationForms.id, id))
        .returning(),
      'application_form',
    );

    await writeAudit(tx, actor, {
      action: status === 'published' ? 'publish' : 'unpublish',
      entityType: 'application_form',
      entityId: id,
      diff: { status: { from: form.status, to: after.status } },
    });

    return loadForm(tx, id);
  });
}

/**
 * Deleting a form cascades to every application on it.
 *
 * Admin only, both here and in `application_forms.rt_delete`. The count is read
 * first and put in the audit entry, because "deleted a form" and "deleted a
 * form and the 240 applications under it" are different events and the log has
 * to be able to say which one happened.
 */
export async function deleteForm(db: Db, actor: Actor, id: string): Promise<void> {
  assertCan(actor, 'content.delete');

  await withActor(db, actor, async (tx) => {
    const form = await loadForm(tx, id);

    await writeAudit(tx, actor, {
      action: 'delete',
      entityType: 'application_form',
      entityId: id,
      diff: {
        slug: { from: form.slug, to: null },
        applications: { from: form.applicationCount, to: 0 },
      },
    });

    await tx.delete(applicationForms).where(eq(applicationForms.id, id));
  });
}

// ── Fields ───────────────────────────────────────────────────────────────

/** Builds a field row from a catalogue entry. The one path that may set `pattern`. */
function rowFromCatalog(
  formId: string,
  entry: NonNullable<ReturnType<typeof catalogField>>,
  sortOrder: number,
  required?: boolean,
) {
  return {
    formId,
    sortOrder,
    key: entry.key,
    type: entry.type,
    catalogKey: entry.key,
    labelAr: entry.labelAr,
    labelEn: entry.labelEn,
    placeholderAr: entry.placeholderAr ?? null,
    helpAr: entry.helpAr ?? null,
    helpEn: entry.helpEn ?? null,
    required: required ?? entry.defaultRequired ?? false,
    sensitive: entry.sensitive ?? false,
    options: (entry.options ?? []) as ApplicationFieldOption[],
    // The catalogue's config is copied in, including any `pattern`. From here
    // the row stands alone: editing the catalogue later must not silently
    // change the validation of a form that is already collecting applications.
    config: entry.config ?? {},
  };
}

async function nextSortOrder(tx: Tx, formId: string): Promise<number> {
  const [last] = await tx
    .select({ max: sql<number | null>`max(${applicationFormFields.sortOrder})` })
    .from(applicationFormFields)
    .where(eq(applicationFormFields.formId, formId));
  return (last?.max ?? -10) + 10;
}

/** A form that has applications may not have its field *keys* changed. */
async function hasApplications(tx: Tx, formId: string): Promise<boolean> {
  const [row] = await tx
    .select({ n: count() })
    .from(applications)
    .where(eq(applications.formId, formId))
    .limit(1);
  return (row?.n ?? 0) > 0;
}

export async function addCatalogFieldToForm(
  db: Db,
  actor: Actor,
  formId: string,
  catalogKey: string,
  required?: boolean,
): Promise<ApplicationFormField> {
  assertCan(actor, 'content.write');

  const entry = catalogField(catalogKey);
  if (!entry) throw notFound('catalog_field');

  return withActor(db, actor, async (tx) => {
    const [existing] = await tx
      .select({ id: applicationFormFields.id })
      .from(applicationFormFields)
      .where(
        and(eq(applicationFormFields.formId, formId), eq(applicationFormFields.key, entry.key)),
      )
      .limit(1);

    if (existing) {
      throw conflict('errors.applicationForm.fieldExists', {
        catalogKey: ['errors.applicationForm.fieldExists'],
      });
    }

    const field = one(
      await tx
        .insert(applicationFormFields)
        .values(rowFromCatalog(formId, entry, await nextSortOrder(tx, formId), required))
        .returning(),
      'application_form_field',
    );

    await writeAudit(tx, actor, {
      action: 'update',
      entityType: 'application_form',
      entityId: formId,
      diff: { field: { from: null, to: `+ ${field.key} (catalog)` } },
    });

    return field;
  });
}

/**
 * Validates a condition against the field order it will live in.
 *
 * Backwards-only, and the controlling field must be one that holds a value —
 * conditioning a question on a section heading is a condition that can never
 * be true.
 */
function assertConditionIsBackwards(
  input: ApplicationFieldInput,
  siblings: ApplicationFormField[],
  selfId?: string,
): void {
  const condition = input.visibleWhen;
  if (!condition) return;

  const target = siblings.find((field) => field.key === condition.field);
  if (!target || target.id === selfId) {
    throw new AppError('validation', 'errors.applicationForm.conditionUnknownField', {
      fieldErrors: { visibleWhen: ['errors.applicationForm.conditionUnknownField'] },
    });
  }

  if (target.type === 'section' || target.type === 'file') {
    throw new AppError('validation', 'errors.applicationForm.conditionBadField', {
      fieldErrors: { visibleWhen: ['errors.applicationForm.conditionBadField'] },
    });
  }

  if (target.sortOrder >= input.sortOrder) {
    throw new AppError('validation', 'errors.applicationForm.conditionForwards', {
      fieldErrors: { visibleWhen: ['errors.applicationForm.conditionForwards'] },
    });
  }
}

export async function saveField(
  db: Db,
  actor: Actor,
  formId: string,
  input: ApplicationFieldInput,
): Promise<ApplicationFormField> {
  assertCan(actor, 'content.write');

  return withActor(db, actor, async (tx) => {
    const siblings = await tx
      .select()
      .from(applicationFormFields)
      .where(eq(applicationFormFields.formId, formId))
      .orderBy(asc(applicationFormFields.sortOrder));

    const existing = input.id ? siblings.find((field) => field.id === input.id) : undefined;
    if (input.id && !existing) throw notFound('application_form_field');

    const duplicate = siblings.find(
      (field) => field.key === input.key && field.id !== existing?.id,
    );
    if (duplicate) {
      throw conflict('errors.applicationForm.fieldExists', {
        key: ['errors.applicationForm.fieldExists'],
      });
    }

    // Rule 1: a key freezes once an answer has been stored under it.
    if (existing && existing.key !== input.key && (await hasApplications(tx, formId))) {
      throw new AppError('conflict', 'errors.applicationForm.keyFrozen', {
        fieldErrors: { key: ['errors.applicationForm.keyFrozen'] },
      });
    }

    assertConditionIsBackwards(input, siblings, existing?.id);

    const columns = {
      formId,
      sortOrder: input.sortOrder,
      key: input.key,
      type: input.type,
      // A catalogue field **keeps** its provenance through an edit, because
      // the thing that marker promises — vetted validation — survives the
      // edit: `config.pattern` is carried over below, and it is the only
      // property an admin could not have written. What the editor can change
      // is the label, the hint and whether the field is required, none of
      // which weaken anything. Clearing the marker here would say the
      // validation had changed when it had not.
      catalogKey: existing?.catalogKey ?? null,
      labelAr: input.labelAr,
      labelEn: input.labelEn || null,
      placeholderAr: input.placeholderAr || null,
      placeholderEn: input.placeholderEn || null,
      helpAr: input.helpAr || null,
      helpEn: input.helpEn || null,
      required: input.required,
      sensitive: input.sensitive,
      options: input.options,
      // `pattern` cannot arrive from the client (the Zod schema has no such
      // key), so an existing catalogue pattern is carried over explicitly
      // rather than lost on every save.
      config: {
        ...input.config,
        ...(existing?.config.pattern ? { pattern: existing.config.pattern } : {}),
      },
      visibleWhen: input.visibleWhen ?? null,
    };

    const field = existing
      ? one(
          await tx
            .update(applicationFormFields)
            .set(columns)
            .where(eq(applicationFormFields.id, existing.id))
            .returning(),
          'application_form_field',
        )
      : one(
          await tx.insert(applicationFormFields).values(columns).returning(),
          'application_form_field',
        );

    await writeAudit(tx, actor, {
      action: 'update',
      entityType: 'application_form',
      entityId: formId,
      diff: computeDiff(
        (existing ?? null) as Record<string, unknown> | null,
        field as unknown as Record<string, unknown>,
      ),
    });

    return field;
  });
}

/**
 * Removing a field does **not** remove the answers already given to it.
 *
 * `applications.answers` keeps them, and the exporter unions the current field
 * list with the keys actually present, so a column deleted in week three still
 * appears in the spreadsheet for the applicants who answered it in week one.
 * Deleting the field is a change to the form, not a rewrite of history.
 */
export async function deleteField(
  db: Db,
  actor: Actor,
  formId: string,
  fieldId: string,
): Promise<void> {
  assertCan(actor, 'content.write');

  await withActor(db, actor, async (tx) => {
    const field = one(
      await tx
        .select()
        .from(applicationFormFields)
        .where(
          and(eq(applicationFormFields.id, fieldId), eq(applicationFormFields.formId, formId)),
        )
        .limit(1),
      'application_form_field',
    );

    // A field that another field's condition points at cannot go quietly: the
    // dependent field would become unconditionally visible, which is the
    // opposite of what the admin set up.
    const dependents = await tx
      .select({ key: applicationFormFields.key })
      .from(applicationFormFields)
      .where(
        and(
          eq(applicationFormFields.formId, formId),
          sql`${applicationFormFields.visibleWhen}->>'field' = ${field.key}`,
        ),
      );

    if (dependents.length > 0) {
      throw new AppError('conflict', 'errors.applicationForm.fieldHasDependents', {
        meta: { dependents: dependents.map((d) => d.key) },
      });
    }

    await tx.delete(applicationFormFields).where(eq(applicationFormFields.id, fieldId));

    await writeAudit(tx, actor, {
      action: 'update',
      entityType: 'application_form',
      entityId: formId,
      diff: { field: { from: field.key, to: null } },
    });
  });
}

/**
 * Reordering, as one list of ids.
 *
 * Renumbered in tens from zero rather than swapped pairwise: a drag from
 * position twelve to position two is one statement per field either way, and a
 * full renumber cannot leave two fields sharing a `sortOrder` the way a
 * sequence of swaps can when two requests overlap.
 *
 * A reorder that would put a conditional field before the field it depends on
 * is refused, because rule 2 has to hold after the move as well as before it.
 */
export async function reorderFields(
  db: Db,
  actor: Actor,
  formId: string,
  ids: string[],
): Promise<void> {
  assertCan(actor, 'content.write');

  await withActor(db, actor, async (tx) => {
    const fields = await tx
      .select()
      .from(applicationFormFields)
      .where(eq(applicationFormFields.formId, formId));

    const byId = new Map(fields.map((field) => [field.id, field]));
    const ordered = ids.map((id) => byId.get(id)).filter((field) => field !== undefined);

    if (ordered.length !== fields.length) {
      throw new AppError('validation', 'errors.applicationForm.reorderIncomplete');
    }

    const positionOf = new Map(ordered.map((field, index) => [field.key, index]));
    for (const [index, field] of ordered.entries()) {
      const target = field.visibleWhen?.field;
      if (target === undefined) continue;
      const targetPosition = positionOf.get(target);
      if (targetPosition === undefined || targetPosition >= index) {
        throw new AppError('validation', 'errors.applicationForm.conditionForwards', {
          meta: { field: field.key, dependsOn: target },
        });
      }
    }

    for (const [index, field] of ordered.entries()) {
      await tx
        .update(applicationFormFields)
        .set({ sortOrder: index * 10 })
        .where(eq(applicationFormFields.id, field.id));
    }

    await writeAudit(tx, actor, {
      action: 'update',
      entityType: 'application_form',
      entityId: formId,
      diff: { fieldOrder: { from: null, to: ordered.map((field) => field.key).join(', ') } },
    });
  });
}

/**
 * Whether a form is taking applications *right now*.
 *
 * The same four conditions `app.submit_application()` enforces, restated in
 * TypeScript so a page can render "closed" instead of a form the visitor would
 * fill in and then be refused. The duplication is deliberate: this one decides
 * what to show, that one decides what to store, and only the database's answer
 * is authoritative.
 */
export function isFormOpen(
  form: Pick<
    ApplicationForm,
    'status' | 'opensAt' | 'closesAt' | 'capacity' | 'capacityRule' | 'submissionCount'
  >,
  now: Date = new Date(),
): { open: boolean; reason?: 'unpublished' | 'not_yet' | 'closed' | 'full' } {
  if (form.status !== 'published') return { open: false, reason: 'unpublished' };
  if (form.opensAt && now < form.opensAt) return { open: false, reason: 'not_yet' };
  if (form.closesAt && now >= form.closesAt) return { open: false, reason: 'closed' };
  if (
    form.capacity !== null &&
    form.submissionCount >= form.capacity &&
    form.capacityRule === 'close'
  ) {
    return { open: false, reason: 'full' };
  }
  return { open: true };
}

/** Kept for the action layer, which must not construct an `AppError` itself. */
export function assertFormEditable(actor: Actor): void {
  if (!actor.isActive) throw forbidden('inactive actor');
}
