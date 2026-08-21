'use client';

import { useActionState } from 'react';
import type { EntityResult } from '@/actions/admin/entity-forms';
import { BilingualField } from '@/components/admin/bilingual-field';
import {
  CheckboxField,
  EnumSelect,
  Field,
  PublishBar,
  fieldDescribedBy,
  inputClass,
} from '@/components/admin/controls';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import type { RichText } from '@/db/schema/_shared';
import type { ContentStatus } from '@/db/schema/enums';

/**
 * The editor for every content entity except projects.
 *
 * Driven by a field list rather than written per entity, which is what makes a
 * twelfth entity a config entry instead of a screen (05-ADMIN §3). Projects
 * keep their own form because two junction tables and a partner/donor split do
 * not compress into a field descriptor without inventing a worse abstraction.
 */

export type FieldSpec =
  | { kind: 'bilingual'; name: string; label: string; required?: boolean; multiline?: boolean; max?: number; hint?: string }
  | { kind: 'richtext'; name: string; labelAr: string; labelEn: string }
  | { kind: 'text'; name: string; label: string; required?: boolean; hint?: string; type?: 'text' | 'date' | 'email' | 'number' }
  | { kind: 'textarea'; name: string; label: string; hint?: string }
  | { kind: 'select'; name: string; label: string; options: { value: string; label: string }[]; required?: boolean; multiple?: boolean; hint?: string }
  | { kind: 'checkbox'; name: string; label: string; hint?: string }
  | { kind: 'media'; name: string; label: string; hint?: string };

export type ContentFormValues = Record<string, unknown> & {
  id?: string;
  status?: ContentStatus;
};

export function ContentForm({
  action,
  fields,
  values,
  canPublish,
  canDelete,
  includeSeo = true,
}: {
  action: (prev: EntityResult | null, formData: FormData) => Promise<EntityResult>;
  fields: FieldSpec[];
  values: ContentFormValues;
  canPublish: boolean;
  canDelete: boolean;
  includeSeo?: boolean;
}) {
  const [state, formAction, pending] = useActionState<EntityResult | null, FormData>(action, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const firstError = (field: string) => errors?.[field]?.[0];

  const str = (key: string) => (values[key] as string | null | undefined) ?? '';
  const doc = (key: string) => (values[key] as RichText | null | undefined) ?? null;

  return (
    <form action={formAction} className="space-y-8">
      {values.id ? <input type="hidden" name="id" value={String(values.id)} /> : null}

      {state && !state.ok ? (
        <div className="rule-edge border-gold-600 bg-gold-050 p-4" role="alert">
          <p className="text-small text-ink">تحقّق من الحقول المميّزة.</p>
        </div>
      ) : null}

      {fields.map((field) => {
        switch (field.kind) {
          case 'bilingual':
            return (
              <BilingualField
                key={field.name}
                name={field.name}
                label={field.label}
                required={field.required}
                multiline={field.multiline}
                hint={field.hint}
                maxLength={field.max ? { ar: field.max, en: field.max } : undefined}
                defaultAr={str(`${field.name}Ar`)}
                defaultEn={str(`${field.name}En`)}
                errorAr={firstError(`${field.name}Ar`)}
                errorEn={firstError(`${field.name}En`)}
              />
            );

          case 'richtext':
            return (
              <div key={field.name} className="grid gap-6 md:grid-cols-2">
                <RichTextEditor
                  name={`${field.name}Ar`}
                  label={field.labelAr}
                  defaultValue={doc(`${field.name}Ar`)}
                />
                <RichTextEditor
                  name={`${field.name}En`}
                  label={field.labelEn}
                  dir="ltr"
                  defaultValue={doc(`${field.name}En`)}
                />
              </div>
            );

          case 'text':
            return (
              <Field
                key={field.name}
                name={field.name}
                label={field.label}
                hint={field.hint}
                error={firstError(field.name)}
                required={field.required}
              >
                <input
                  id={field.name}
                  name={field.name}
                  type={field.type ?? 'text'}
                  required={field.required}
                  defaultValue={str(field.name)}
                  aria-invalid={firstError(field.name) ? true : undefined}
                  aria-describedby={fieldDescribedBy(field.name, field.hint, firstError(field.name))}
                  className={inputClass}
                />
              </Field>
            );

          case 'textarea':
            return (
              <Field
                key={field.name}
                name={field.name}
                label={field.label}
                hint={field.hint}
                error={firstError(field.name)}
              >
                <textarea
                  id={field.name}
                  name={field.name}
                  rows={3}
                  defaultValue={str(field.name)}
                  aria-invalid={firstError(field.name) ? true : undefined}
                  aria-describedby={fieldDescribedBy(field.name, field.hint, firstError(field.name))}
                  className={inputClass}
                />
              </Field>
            );

          case 'select':
            return (
              <EnumSelect
                key={field.name}
                name={field.name}
                label={field.label}
                options={field.options}
                required={field.required}
                multiple={field.multiple}
                hint={field.hint}
                defaultValue={
                  field.multiple
                    ? ((values[field.name] as string[] | undefined) ?? [])
                    : str(field.name)
                }
              />
            );

          case 'checkbox':
            return (
              <CheckboxField
                key={field.name}
                name={field.name}
                label={field.label}
                hint={field.hint}
                defaultChecked={Boolean(values[field.name])}
              />
            );

          case 'media':
            return (
              <Field
                key={field.name}
                name={field.name}
                label={field.label}
                hint={field.hint}
                error={firstError(field.name)}
              >
                <input
                  id={field.name}
                  name={field.name}
                  defaultValue={str(field.name)}
                  dir="ltr"
                  aria-invalid={firstError(field.name) ? true : undefined}
                  aria-describedby={fieldDescribedBy(field.name, field.hint, firstError(field.name))}
                  className={`${inputClass} text-start font-mono text-caption`}
                />
              </Field>
            );
        }
      })}

      {includeSeo ? (
        <details className="rule-edge bg-paper p-5">
          <summary className="cursor-pointer text-small font-medium text-ink">
            تحسين محركات البحث
          </summary>
          <div className="mbs-5 space-y-6">
            <BilingualField
              name="seoTitle"
              label="عنوان SEO"
              maxLength={{ ar: 60, en: 60 }}
              hint="العربية أطول بنحو 10% لكل حرف."
              defaultAr={str('seoTitleAr')}
              defaultEn={str('seoTitleEn')}
            />
            <BilingualField
              name="seoDescription"
              label="وصف SEO"
              multiline
              maxLength={{ ar: 160, en: 160 }}
              defaultAr={str('seoDescriptionAr')}
              defaultEn={str('seoDescriptionEn')}
            />
            <CheckboxField
              name="noIndex"
              label="منع الفهرسة"
              defaultChecked={Boolean(values.noIndex)}
            />
          </div>
        </details>
      ) : null}

      <fieldset disabled={pending}>
        <PublishBar
          status={values.status ?? 'draft'}
          canPublish={canPublish}
          canDelete={canDelete}
        />
      </fieldset>
    </form>
  );
}
