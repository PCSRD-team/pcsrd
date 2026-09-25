'use server';

import { redirect } from 'next/navigation';
import { db } from '@/db';
import { requireActor } from '@/lib/auth/guard';
import { revalidate } from '@/lib/cache/revalidate';
import { TAGS } from '@/lib/cache/tags';
import { type ActionResult, err, ok, runAction } from '@/lib/errors';
import { STARTER_FIELDS } from '@/lib/applications/field-catalog';
import { fieldErrorsFrom } from '@/lib/validation/common';
import { parseAdminForm } from '@/lib/validation/form-data';
import {
  addCatalogFieldSchema,
  applicationFieldSchema,
  applicationFormSchema,
  reorderFieldsSchema,
} from '@/lib/validation/applications';
import {
  addCatalogFieldToForm,
  createForm,
  deleteField,
  deleteForm,
  reorderFields,
  saveField,
  setFormStatus,
  updateForm,
} from '@/services/applications/application-form.service';
import { withFlash } from './flash';

/**
 * The form builder's POST endpoints.
 *
 * Every one is the same five steps — guard, parse, validate, call the service,
 * revalidate — and contains no `if` that is not about HTTP or validation. The
 * rules about keys freezing, conditions pointing backwards and consent gating
 * publication all live in `application-form.service.ts`, where a seed script
 * and a test reach them too.
 *
 * **Every action here works without JavaScript.** Each is wired to a plain
 * `<form action={...}>` in a Server Component, and each redirects back to the
 * builder with a flash key on the query string. That is not a fallback path
 * that happens to work — it is the only path, and the browser's own form
 * submission is what drives it.
 */

export type FormResult = ActionResult<{ id: string }>;

/**
 * Both tags, every time.
 *
 * The list tag alone would leave `/ar/apply/<slug>` serving a form whose
 * deadline moved an hour ago; the slug tag alone would leave the careers index
 * advertising a form that has closed. A builder edit is rare and both tags are
 * cheap, so there is no case for being clever about which one changed.
 */
function bustForm(slug?: string | null) {
  revalidate(slug ? [TAGS.applicationForm(slug), TAGS.applicationFormList] : [TAGS.applicationFormList]);
}

const FORM_SHAPE = {
  json: ['introAr', 'introEn'],
  booleans: ['allowMultiplePerEmail', 'requireConsent'],
  nullable: ['opensAt', 'closesAt', 'capacity', 'vacancyId', 'titleEn'],
} as const;

export async function createApplicationForm(
  _prev: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const result = await runAction<{ id: string }>(async () => {
    const actor = await requireActor();

    const parsed = applicationFormSchema.safeParse(parseAdminForm(formData, FORM_SHAPE));
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }

    // A new form starts with the fields its kind almost always needs. The
    // admin can remove any of them; starting from an empty form means every
    // new vacancy begins by adding "full name" by hand.
    const starters = STARTER_FIELDS[parsed.data.kind] ?? [];
    const form = await createForm(db, actor, parsed.data, starters);

    bustForm(form.slug);
    return ok({ id: form.id }, 'admin.saved');
  });

  if (result.ok) redirect(`/admin/careers/${result.data.id}?ok=admin.saved`);
  return result;
}

export async function updateApplicationForm(
  _prev: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const id = String(formData.get('id') ?? '');

  const result = await runAction<{ id: string }>(async () => {
    const actor = await requireActor();

    const parsed = applicationFormSchema.safeParse(parseAdminForm(formData, FORM_SHAPE));
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }

    const form = await updateForm(db, actor, id, parsed.data);

    // The slug may have changed, so the *old* one has to be busted too or its
    // cached page outlives the rename.
    const previousSlug = String(formData.get('previousSlug') ?? '');
    bustForm(form.slug);
    if (previousSlug && previousSlug !== form.slug) bustForm(previousSlug);

    return ok({ id: form.id }, 'admin.saved');
  });

  if (result.ok) redirect(`/admin/careers/${id}?ok=admin.saved`);
  return result;
}

/**
 * Publish / unpublish / archive.
 *
 * A separate endpoint rather than a `status` field on the save form: publishing
 * needs a capability the save does not, and the three refusals in
 * `setFormStatus` are about the form as a whole rather than about one input.
 */
export async function setApplicationFormStatus(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const raw = String(formData.get('status') ?? '');
  const returnTo = formData.get('returnTo');

  const result = await runAction<{ id: string }>(async () => {
    const actor = await requireActor();

    if (raw !== 'draft' && raw !== 'in_review' && raw !== 'published' && raw !== 'archived') {
      return err('validation', 'errors.validation');
    }

    const form = await setFormStatus(db, actor, id, raw);
    bustForm(form.slug);
    return ok({ id }, 'admin.statusChanged');
  });

  redirect(withFlash(returnTo ?? `/admin/careers/${id}`, result));
}

export async function deleteApplicationForm(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');

  const result = await runAction<{ id: string }>(async () => {
    const actor = await requireActor();
    await deleteForm(db, actor, id);
    bustForm(String(formData.get('slug') ?? ''));
    return ok({ id }, 'admin.deleted');
  });

  redirect(withFlash('/admin/careers', result));
}

// ── Fields ───────────────────────────────────────────────────────────────

export async function addCatalogField(formData: FormData): Promise<void> {
  const formId = String(formData.get('formId') ?? '');
  const returnTo = formData.get('returnTo');

  const result = await runAction<{ id: string }>(async () => {
    const actor = await requireActor();

    const parsed = addCatalogFieldSchema.safeParse({
      catalogKey: formData.get('catalogKey'),
      required: formData.get('required'),
    });
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }

    const field = await addCatalogFieldToForm(
      db,
      actor,
      formId,
      parsed.data.catalogKey,
      parsed.data.required,
    );

    bustForm(String(formData.get('slug') ?? ''));
    return ok({ id: field.id }, 'admin.saved');
  });

  redirect(withFlash(returnTo ?? `/admin/careers/${formId}`, result));
}

const FIELD_SHAPE = {
  multi: ['optionValues', 'optionLabelsAr', 'optionLabelsEn', 'conditionEquals'],
  booleans: ['required', 'sensitive'],
  nullable: ['labelEn', 'placeholderAr', 'placeholderEn', 'helpAr', 'helpEn', 'id'],
} as const;

/**
 * Reassembles the option rows.
 *
 * The builder posts three parallel arrays — value, Arabic label, English label
 * — because a repeating group of three inputs is the only shape a plain HTML
 * form can express without scripting. A row with no value is a blank line the
 * admin left behind, not an option, so it is dropped rather than rejected.
 */
function shapeOptions(raw: Record<string, unknown>): Record<string, unknown> {
  const values = (raw.optionValues as string[] | undefined) ?? [];
  const labelsAr = (raw.optionLabelsAr as string[] | undefined) ?? [];
  const labelsEn = (raw.optionLabelsEn as string[] | undefined) ?? [];

  const options = values
    .map((value, index) => ({
      value: value.trim(),
      labelAr: (labelsAr[index] ?? '').trim(),
      labelEn: (labelsEn[index] ?? '').trim() || null,
    }))
    .filter((option) => option.value !== '' && option.labelAr !== '');

  // The editor posts the condition's values as one comma-separated input,
  // because a repeating group for them would need an "add value" button and
  // that button would need JavaScript. Split here rather than in the schema:
  // the schema describes the shape a service receives, not the shape a
  // particular form happened to produce.
  const conditionField = String(raw.conditionField ?? '').trim();
  const conditionEquals = ((raw.conditionEquals as string[] | undefined) ?? [])
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    ...raw,
    options,
    visibleWhen:
      conditionField && conditionEquals.length > 0
        ? { field: conditionField, equals: conditionEquals }
        : null,
    config: {
      ...(raw.minLength ? { minLength: raw.minLength } : {}),
      ...(raw.maxLength ? { maxLength: raw.maxLength } : {}),
      ...(raw.min ? { min: raw.min } : {}),
      ...(raw.max ? { max: raw.max } : {}),
      ...(raw.minDate ? { minDate: raw.minDate } : {}),
      ...(raw.maxDate ? { maxDate: raw.maxDate } : {}),
      ...(raw.accept ? { accept: raw.accept } : {}),
      ...(raw.minChoices ? { minChoices: raw.minChoices } : {}),
      ...(raw.maxChoices ? { maxChoices: raw.maxChoices } : {}),
    },
  };
}

export async function saveApplicationField(
  _prev: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const formId = String(formData.get('formId') ?? '');

  const result = await runAction<{ id: string }>(async () => {
    const actor = await requireActor();

    const parsed = applicationFieldSchema.safeParse(
      shapeOptions(parseAdminForm(formData, FIELD_SHAPE)),
    );
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }

    const field = await saveField(db, actor, formId, parsed.data);
    bustForm(String(formData.get('slug') ?? ''));
    return ok({ id: field.id }, 'admin.saved');
  });

  if (result.ok) redirect(`/admin/careers/${formId}?ok=admin.saved`);
  return result;
}

export async function deleteApplicationField(formData: FormData): Promise<void> {
  const formId = String(formData.get('formId') ?? '');
  const fieldId = String(formData.get('fieldId') ?? '');

  const result = await runAction<{ id: string }>(async () => {
    const actor = await requireActor();
    await deleteField(db, actor, formId, fieldId);
    bustForm(String(formData.get('slug') ?? ''));
    return ok({ id: fieldId }, 'admin.deleted');
  });

  redirect(withFlash(`/admin/careers/${formId}`, result));
}

/**
 * Moves one field up or down.
 *
 * Reordering is expressed as "move this one" rather than "here is the new
 * order" because the builder has to work without JavaScript, and a pair of
 * arrow buttons is the whole interaction a plain form can offer. The service
 * still takes the full ordered list — this reads the current order, swaps two
 * entries and hands the result over, so the invariant it checks (no field
 * before the field it depends on) is checked against the order that will
 * actually be stored.
 */
export async function moveApplicationField(formData: FormData): Promise<void> {
  const formId = String(formData.get('formId') ?? '');
  const fieldId = String(formData.get('fieldId') ?? '');
  const direction = formData.get('direction') === 'up' ? -1 : 1;

  const result = await runAction<{ id: string }>(async () => {
    const actor = await requireActor();

    const order = String(formData.get('order') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const index = order.indexOf(fieldId);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= order.length) {
      // Already at the end of the list. Not an error — the arrow is simply
      // disabled in the markup and this is the racing double-click.
      return ok({ id: fieldId });
    }

    const next = [...order];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(target, 0, moved);

    const parsed = reorderFieldsSchema.safeParse({ ids: next });
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }

    await reorderFields(db, actor, formId, parsed.data.ids);
    bustForm(String(formData.get('slug') ?? ''));
    return ok({ id: fieldId }, 'admin.saved');
  });

  redirect(withFlash(`/admin/careers/${formId}`, result));
}
