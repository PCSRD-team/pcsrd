'use client';
// Client Component: `useActionState` places a rejected save's errors on the
// fields that caused them. The form still submits natively before hydration.

import { useActionState } from 'react';
import type { EntityResult } from '@/actions/admin/entity-forms';
import { BilingualField } from '@/components/admin/bilingual-field';
import { PublishBar, SaveBar } from '@/components/admin/controls';
import { GalleryPicker } from '@/components/admin/gallery-picker';
import { MediaPicker } from '@/components/admin/media-picker';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { describedBy, Field, FieldRow } from '@/components/ui/field';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/inputs';
import { Stack } from '@/components/ui/layout';
import { Notice } from '@/components/ui/notice';
import { ADMIN_OPTIONS } from '@/lib/admin-options';
import type { RichText } from '@/db/schema/_shared';
import type { ContentStatus } from '@/db/schema/enums';
import { type AdminFormDict, resolveAdminKey } from './admin-dict';
import { adminUi } from './admin-ui-dict';

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
  const f = adminUi.form;

  return (
    <form action={formAction}>
      <Stack gap={8}>
        {values.id ? <input type="hidden" name="id" value={String(values.id)} /> : null}

        {bannerText ? (
          <Notice tone="danger" title={formLevel.length ? bannerText : undefined}>
            {formLevel.length ? (
              formLevel.map((text) => <p key={text}>{text}</p>)
            ) : (
              bannerText
            )}
          </Notice>
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
                <FieldRow key={field.name}>
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
                </FieldRow>
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
                  <Input
                    name={field.name}
                    type={field.type ?? 'text'}
                    required={field.required}
                    defaultValue={str(field.name)}
                    hint={field.hint}
                    error={firstError(field.name)}
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
                  <Textarea
                    name={field.name}
                    rows={3}
                    defaultValue={str(field.name)}
                    hint={field.hint}
                    error={firstError(field.name)}
                  />
                </Field>
              );

            case 'select':
              return (
                <Field
                  key={field.name}
                  name={field.name}
                  label={field.label}
                  hint={field.hint}
                  error={firstError(field.name)}
                  required={field.required}
                >
                  <Select
                    name={field.name}
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
                </Field>
              );

            case 'checkbox':
              return (
                <Checkbox
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
                    describedBy={describedBy(field.name, field.hint, firstError(field.name))}
                  />
                </Field>
              );
          }
        })}

        {includeSeo ? (
          <details className="rule-edge bg-paper p-6">
            <summary className="cursor-pointer text-small font-medium text-ink">{f.seo}</summary>
            <Stack gap={6} className="mbs-5">
              <BilingualField
                name="seoTitle"
                label={f.seoTitle}
                maxLength={{ ar: 60, en: 60 }}
                hint={f.seoTitleHint}
                defaultAr={str('seoTitleAr')}
                defaultEn={str('seoTitleEn')}
              />
              <BilingualField
                name="seoDescription"
                label={f.seoDescription}
                multiline
                maxLength={{ ar: 160, en: 160 }}
                defaultAr={str('seoDescriptionAr')}
                defaultEn={str('seoDescriptionEn')}
              />
              <Field
                name="ogMediaId"
                label={f.ogImage}
                hint={f.ogImageHint}
                error={firstError('ogMediaId')}
              >
                <MediaPicker
                  name="ogMediaId"
                  initialValue={str('ogMediaId')}
                  kind="image"
                  invalid={Boolean(firstError('ogMediaId'))}
                  describedBy={describedBy('ogMediaId', f.ogImageHint, firstError('ogMediaId'))}
                />
              </Field>
              <Checkbox name="noIndex" label={f.noIndex} defaultChecked={Boolean(values.noIndex)} />
            </Stack>
          </details>
        ) : null}

        {bar === 'publish' && translation ? (
          <Field
            name="translationStatus"
            label={f.translationStatus}
            hint={f.translationStatusHint}
            error={firstError('translationStatus')}
          >
            <Select
              name="translationStatus"
              options={[...ADMIN_OPTIONS.translationStatus]}
              defaultValue={str('translationStatus') || 'ar_only'}
              hint={f.translationStatusHint}
              error={firstError('translationStatus')}
            />
          </Field>
        ) : null}

        <fieldset disabled={pending}>
          {bar === 'publish' ? (
            <PublishBar
              status={(values.status as ContentStatus | undefined) ?? 'draft'}
              canPublish={canPublish}
            />
          ) : (
            <SaveBar label={dict.admin.form.save} />
          )}
        </fieldset>
      </Stack>
    </form>
  );
}
