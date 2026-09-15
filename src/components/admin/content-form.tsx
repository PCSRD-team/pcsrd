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
import { GalleryPicker } from '@/components/admin/gallery-picker';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { MediaPicker } from '@/components/admin/media-picker';
import { ADMIN_OPTIONS } from '@/lib/admin-options';
import type { RichText } from '@/db/schema/_shared';
import type { ContentStatus } from '@/db/schema/enums';
import { type AdminFormDict, resolveAdminKey } from './admin-dict';

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
  | { kind: 'media'; name: string; label: string; hint?: string; assetKind?: 'image' | 'document' }
  /** An ordered list of image ids, posted as repeated `name` fields. */
  | { kind: 'gallery'; name: string; label: string; hint?: string };

/**
 * Loosely typed on purpose: a row of any entity is passed straight in, and
 * `status` may be a content lifecycle value or, for an impact figure, a
 * verification state — only the publish bar reads it as the former.
 */
export type ContentFormValues = Record<string, unknown> & { id?: string };

export function ContentForm({
  action,
  fields,
  values,
  canPublish,
  includeSeo = true,
  bar = 'publish',
  translation = true,
  dict,
}: {
  action: (prev: EntityResult | null, formData: FormData) => Promise<EntityResult>;
  fields: FieldSpec[];
  values: ContentFormValues;
  canPublish: boolean;
  includeSeo?: boolean;
  /**
   * `publish` renders the draft / review / publish bar and posts `status`.
   * `save` renders one button, for records with no lifecycle (people, impact
   * figures, media) — where a `status` select of the entity's own may exist
   * and must not collide with the bar's buttons.
   */
  bar?: 'publish' | 'save';
  /**
   * Renders the `translation_status` select. On for the content entities,
   * which all carry the column; off for a partner, which does not.
   */
  translation?: boolean;
  /** `errors` + `admin`, so a service's thrown key renders as a sentence. */
  dict: AdminFormDict;
}) {
  const [state, formAction, pending] = useActionState<EntityResult | null, FormData>(action, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  // Every field kind reads through this, so a rejected save always points at
  // the input that caused it. The key is resolved here, at the last moment.
  const firstError = (field: string) => {
    const key = errors?.[field]?.[0];
    return key ? resolveAdminKey(dict, key) : undefined;
  };

  // STATE-007: the banner used to say "check the highlighted fields" for
  // every failure, including a consent gate or a permission refusal that
  // highlights nothing. When there are no field errors the action's own
  // message is what the editor needs; when there are, the generic prompt plus
  // any form-level (`_form`) issues.
  const hasFieldErrors = Boolean(
    errors && Object.keys(errors).some((key) => key !== '_form' && (errors[key]?.length ?? 0) > 0),
  );
  const bannerText =
    state && !state.ok
      ? hasFieldErrors
        ? resolveAdminKey(dict, 'admin.form.checkFields')
        : resolveAdminKey(dict, state.messageKey)
      : null;
  const formLevel = (errors?._form ?? []).map((key) => resolveAdminKey(dict, key));

  const str = (key: string) => (values[key] as string | null | undefined) ?? '';
  const doc = (key: string) => (values[key] as RichText | null | undefined) ?? null;

  return (
    <form action={formAction} className="space-y-8">
      {values.id ? <input type="hidden" name="id" value={String(values.id)} /> : null}

      {bannerText ? (
        <div className="rule-edge border-gold-600 bg-gold-050 p-4" role="alert">
          <p className="text-small text-ink">{bannerText}</p>
          {formLevel.map((text) => (
            <p key={text} className="mbs-1 text-caption text-ink">
              {text}
            </p>
          ))}
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
                error={firstError(field.name)}
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
                error={firstError(field.name)}
                defaultChecked={Boolean(values[field.name])}
              />
            );

          case 'gallery':
            return (
              <GalleryPicker
                key={field.name}
                name={field.name}
                label={field.label}
                hint={field.hint}
                initial={(values[field.name] as string[] | undefined) ?? []}
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
                <MediaPicker
                  name={field.name}
                  initialValue={str(field.name)}
                  kind={field.assetKind ?? 'image'}
                  invalid={Boolean(firstError(field.name))}
                  describedBy={fieldDescribedBy(field.name, field.hint, firstError(field.name))}
                />
              </Field>
            );
        }
      })}

      {includeSeo ? (
        <details className="rule-edge rounded-lg bg-paper p-5 shadow-[0_10px_28px_rgb(20_33_63/0.04)]">
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
            <Field
              name="ogMediaId"
              label="صورة المشاركة (Open Graph)"
              hint="تظهر عند مشاركة الرابط. إن تُركت فارغة تُستخدم صورة المؤسسة الافتراضية."
              error={firstError('ogMediaId')}
            >
              <MediaPicker
                name="ogMediaId"
                initialValue={str('ogMediaId')}
                kind="image"
                invalid={Boolean(firstError('ogMediaId'))}
                describedBy={fieldDescribedBy('ogMediaId', 'hint', firstError('ogMediaId'))}
              />
            </Field>
            <CheckboxField
              name="noIndex"
              label="منع الفهرسة"
              defaultChecked={Boolean(values.noIndex)}
            />
          </div>
        </details>
      ) : null}

      {bar === 'publish' && translation ? (
        <EnumSelect
          name="translationStatus"
          label="حالة الترجمة"
          options={[...ADMIN_OPTIONS.translationStatus]}
          defaultValue={str('translationStatus') || 'ar_only'}
          hint="تُحدَّد يدوياً. الموقع يعرض المحتوى العربي للقارئ الإنجليزي ما لم تكن الترجمة مراجَعة."
          error={firstError('translationStatus')}
        />
      ) : null}

      <fieldset disabled={pending}>
        {bar === 'publish' ? (
          <PublishBar
            status={(values.status as ContentStatus | undefined) ?? 'draft'}
            canPublish={canPublish}
          />
        ) : (
          <div className="sticky inset-be-0 z-20 mbs-10 flex flex-wrap items-center gap-3 border border-rule bg-paper p-4">
            <div className="flex-1" />
            <button
              type="submit"
              className="bg-navy-700 px-5 py-2 text-small font-medium text-paper hover:bg-navy-900"
            >
              {dict.admin.form.save}
            </button>
          </div>
        )}
      </fieldset>
    </form>
  );
}
