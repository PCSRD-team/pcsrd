'use client';
// Client Component: `useActionState` places a rejected save's errors on the
// field that caused them. The form still submits natively before hydration, so
// a custom field can be built with scripting off.

import { useActionState } from 'react';
import type { FormResult } from '@/actions/admin/application-forms';
import { SaveBar } from '@/components/admin/controls';
import { Field, FieldRow } from '@/components/ui/field';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/inputs';
import { Cluster, Stack } from '@/components/ui/layout';
import { Notice } from '@/components/ui/notice';
import { Eyebrow } from '@/components/ui/typography';
import type { ApplicationFormField } from '@/db/schema/applications';
import { applicationFieldType } from '@/db/schema/enums';
import { type AdminFormDict, resolveAdminKey } from './admin-dict';
import { adminUi } from './admin-ui-dict';

/**
 * The custom-field editor — the free-form half of the builder.
 *
 * The catalogue covers what a recruitment form usually asks. This covers what
 * it does not, and its job is to let an admin build any field without letting
 * them build an unsafe one. Two things it therefore does **not** offer:
 *
 * - **No regular-expression box.** `config.pattern` is absent from the schema
 *   this posts to, so a pattern can only ever have been copied out of the
 *   catalogue by the service. A hand-typed regex is the one field property
 *   that can hang the server, and `(a+)+$` looks like a typo rather than an
 *   attack.
 * - **No free-text file types.** `accept` is a named choice of three, so a
 *   field cannot be widened to take any byte stream by typing a wildcard.
 *
 * Options are three parallel arrays — value, Arabic label, English label —
 * because that is the only shape a plain HTML form can express for a repeating
 * group without scripting. Blank rows are dropped by the action rather than
 * rejected: an admin who needed four options and was given eight rows has left
 * four blanks, not made four mistakes.
 */

/** Enough rows for a governorate list without a scroll, and no "add row" button
 *  to make work without JavaScript. */
const OPTION_ROWS = 8;

export type FieldEditorValues = Partial<ApplicationFormField> & { formId: string };

export function FieldEditor({
  action,
  values,
  slug,
  siblings,
  keyLocked,
  dict,
}: {
  action: (prev: FormResult | null, formData: FormData) => Promise<FormResult>;
  values: FieldEditorValues;
  slug: string;
  /** Fields declared before this one — the only valid condition targets. */
  siblings: Pick<ApplicationFormField, 'id' | 'key' | 'labelAr' | 'type' | 'sortOrder'>[];
  keyLocked: boolean;
  dict: AdminFormDict;
}) {
  const [state, formAction, pending] = useActionState<FormResult | null, FormData>(action, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const t = adminUi.careers;
  const error = (name: string) => errors?.[name]?.map((key) => resolveAdminKey(dict, key));

  const options = values.options ?? [];
  const condition = values.visibleWhen ?? null;

  // A condition may only point at a field that holds a value and comes first.
  // Offering a later field would produce a save the service refuses, on a rule
  // the editor had no way to see.
  const conditionTargets = siblings.filter(
    (field) =>
      field.id !== values.id &&
      field.type !== 'section' &&
      field.type !== 'file' &&
      field.sortOrder < (values.sortOrder ?? Number.MAX_SAFE_INTEGER),
  );

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="formId" value={values.formId} />
      <input type="hidden" name="slug" value={slug} />
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      {/* A new field goes to the end; an existing one keeps its place. The
          arrows on the builder screen are what move it. */}
      <input type="hidden" name="sortOrder" value={values.sortOrder ?? 9999} />

      {state && !state.ok ? (
        <Notice tone="danger" className="mbe-6">
          {resolveAdminKey(dict, state.messageKey)}
        </Notice>
      ) : null}

      <Stack gap={6}>
        <FieldRow>
          <Field name="labelAr" label={t.fieldLabel} error={error('labelAr')} required>
            <Input
              name="labelAr"
              defaultValue={values.labelAr ?? ''}
              required
              error={error('labelAr')}
            />
          </Field>
          <Field name="labelEn" label={`${t.fieldLabel} (EN)`} error={error('labelEn')}>
            <Input name="labelEn" defaultValue={values.labelEn ?? ''} dir="ltr" />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field name="key" label={t.fieldKey} hint={t.fieldKeyHint} error={error('key')} required>
            <Input
              name="key"
              defaultValue={values.key ?? ''}
              dir="ltr"
              required
              readOnly={keyLocked}
              error={error('key')}
            />
          </Field>
          <Field name="type" label={t.fieldType} error={error('type')} required>
            <Select
              name="type"
              defaultValue={values.type ?? 'short_text'}
              options={applicationFieldType.enumValues.map((value) => ({
                value,
                label: t.fieldTypes[value],
              }))}
            />
          </Field>
        </FieldRow>

        <Field name="helpAr" label={t.fieldHelp} error={error('helpAr')}>
          <Textarea name="helpAr" rows={2} defaultValue={values.helpAr ?? ''} />
        </Field>

        <Field name="placeholderAr" label={t.fieldPlaceholder}>
          <Input name="placeholderAr" defaultValue={values.placeholderAr ?? ''} />
        </Field>

        <Cluster gap={6}>
          <Checkbox name="required" label={t.required} defaultChecked={values.required ?? false} />
          <Checkbox
            name="sensitive"
            label={t.sensitive}
            hint={t.sensitiveHint}
            defaultChecked={values.sensitive ?? false}
          />
        </Cluster>

        <section>
          <Eyebrow className="mbe-3">{t.options}</Eyebrow>
          <Stack gap={2}>
            {Array.from({ length: OPTION_ROWS }, (_, index) => {
              const option = options[index];
              return (
                <FieldRow key={index}>
                  {/* The `name` repeats across rows on purpose — that is how
                      the three parallel arrays reach the action. The `id` is
                      per row so each label still points at its own input. */}
                  <Field name={`optionValues-${index}`} label={t.optionValue}>
                    <Input
                      name="optionValues"
                      id={`optionValues-${index}`}
                      defaultValue={option?.value ?? ''}
                      dir="ltr"
                    />
                  </Field>
                  <Field name={`optionLabelsAr-${index}`} label={t.optionLabel}>
                    <Input
                      name="optionLabelsAr"
                      id={`optionLabelsAr-${index}`}
                      defaultValue={option?.labelAr ?? ''}
                    />
                  </Field>
                  <Field name={`optionLabelsEn-${index}`} label={`${t.optionLabel} (EN)`}>
                    <Input
                      name="optionLabelsEn"
                      id={`optionLabelsEn-${index}`}
                      defaultValue={option?.labelEn ?? ''}
                      dir="ltr"
                    />
                  </Field>
                </FieldRow>
              );
            })}
          </Stack>
        </section>

        <section>
          <Eyebrow className="mbe-3">{t.constraints}</Eyebrow>
          <Stack gap={4}>
            <FieldRow>
              <Field name="minLength" label={t.minLength}>
                <Input
                  name="minLength"
                  type="number"
                  min={0}
                  dir="ltr"
                  defaultValue={values.config?.minLength ?? ''}
                />
              </Field>
              <Field name="maxLength" label={t.maxLength}>
                <Input
                  name="maxLength"
                  type="number"
                  min={1}
                  dir="ltr"
                  defaultValue={values.config?.maxLength ?? ''}
                />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field name="min" label={t.minValue}>
                <Input name="min" type="number" dir="ltr" defaultValue={values.config?.min ?? ''} />
              </Field>
              <Field name="max" label={t.maxValue}>
                <Input name="max" type="number" dir="ltr" defaultValue={values.config?.max ?? ''} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field name="minDate" label={t.minDate}>
                <Input
                  name="minDate"
                  type="date"
                  dir="ltr"
                  defaultValue={values.config?.minDate ?? ''}
                />
              </Field>
              <Field name="maxDate" label={t.maxDate}>
                <Input
                  name="maxDate"
                  type="date"
                  dir="ltr"
                  defaultValue={values.config?.maxDate ?? ''}
                />
              </Field>
            </FieldRow>
            <Field name="accept" label={t.accept}>
              <Select
                name="accept"
                defaultValue={values.config?.accept ?? ''}
                placeholder={adminUi.list.all}
                options={[
                  { value: 'document', label: t.acceptDocument },
                  { value: 'image', label: t.acceptImage },
                  { value: 'any', label: t.acceptAny },
                ]}
              />
            </Field>
          </Stack>
        </section>

        {conditionTargets.length > 0 ? (
          <section>
            <Eyebrow className="mbe-3">{t.condition}</Eyebrow>
            <p className="mbe-4 text-caption text-ink-70">{t.conditionHint}</p>
            <FieldRow>
              <Field name="conditionField" label={t.conditionField} error={error('visibleWhen')}>
                <Select
                  name="conditionField"
                  defaultValue={condition?.field ?? ''}
                  placeholder={adminUi.list.all}
                  options={conditionTargets.map((field) => ({
                    value: field.key,
                    label: field.labelAr,
                  }))}
                />
              </Field>
              <Field name="conditionEquals" label={t.conditionEquals}>
                <Input
                  name="conditionEquals"
                  dir="ltr"
                  defaultValue={condition?.equals.join(',') ?? ''}
                />
              </Field>
            </FieldRow>
          </section>
        ) : null}
      </Stack>

      <SaveBar pending={pending} />
    </form>
  );
}
