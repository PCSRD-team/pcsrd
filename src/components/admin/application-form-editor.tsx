'use client';
// Client Component: `useActionState` places a rejected save's errors on the
// fields that caused them. The form still submits natively before hydration —
// everything below is a plain control inside a plain `<form>`.

import { useActionState } from 'react';
import type { FormResult } from '@/actions/admin/application-forms';
import { SaveBar } from '@/components/admin/controls';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { Field, FieldRow } from '@/components/ui/field';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/inputs';
import { Stack } from '@/components/ui/layout';
import { Notice } from '@/components/ui/notice';
import type { RichText } from '@/db/schema/_shared';
import {
  applicationCapacityRule,
  applicationFormKind,
} from '@/db/schema/enums';
import { type AdminFormDict, resolveAdminKey } from './admin-dict';
import { adminUi } from './admin-ui-dict';

/**
 * The form's own settings — everything except its fields.
 *
 * Not `ContentForm`. That component is driven by a `FieldSpec[]` and covers the
 * seven CMS entities, whose shape is "bilingual text, rich text, media, SEO".
 * A form is none of those: it is a window, a cap, a retention period and a
 * consent switch, and three of those four have to be presented **together**
 * because they only make sense as a group. Expressing that through a flat
 * field list would mean adding a `fieldset` concept to `ContentForm` for one
 * caller.
 *
 * `previousSlug` rides along as a hidden input so the action can bust the cache
 * entry for the *old* slug after a rename. Without it the renamed form's former
 * URL keeps serving a cached page until it expires on its own.
 */

export type ApplicationFormValues = {
  id?: string;
  kind: string;
  slug: string;
  titleAr: string;
  titleEn: string | null;
  introAr: RichText | null;
  introEn: RichText | null;
  opensAt: Date | null;
  closesAt: Date | null;
  capacity: number | null;
  capacityRule: string;
  confirmationAr: string | null;
  confirmationEn: string | null;
  notifyEmails: string[];
  retentionMonths: number;
  allowMultiplePerEmail: boolean;
  requireConsent: boolean;
  vacancyId: string | null;
};

/**
 * `datetime-local` wants `YYYY-MM-DDTHH:mm` in **local** time and will silently
 * ignore anything else, leaving the control blank — which reads as "no
 * deadline" on a form that has one. `toISOString()` is UTC and would be wrong
 * by the timezone offset, so the parts are assembled by hand.
 */
function toLocalInput(date: Date | null): string {
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ApplicationFormEditor({
  action,
  values,
  vacancyOptions,
  dict,
}: {
  action: (prev: FormResult | null, formData: FormData) => Promise<FormResult>;
  values: ApplicationFormValues;
  vacancyOptions: { id: string; title: string }[];
  dict: AdminFormDict;
}) {
  const [state, formAction, pending] = useActionState<FormResult | null, FormData>(action, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const t = adminUi.careers;

  const error = (name: string) => errors?.[name]?.map((key) => resolveAdminKey(dict, key));

  return (
    <form action={formAction} noValidate>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <input type="hidden" name="previousSlug" value={values.slug} />

      {state && !state.ok ? (
        <Notice tone="danger" className="mbe-6">
          {resolveAdminKey(dict, state.messageKey)}
        </Notice>
      ) : null}

      <Stack gap={6}>
        <FieldRow>
          <Field name="titleAr" label={t.formTitle} error={error('titleAr')} required>
            <Input name="titleAr" defaultValue={values.titleAr} required error={error('titleAr')} />
          </Field>
          <Field name="titleEn" label={`${t.formTitle} (EN)`} error={error('titleEn')}>
            <Input name="titleEn" defaultValue={values.titleEn ?? ''} dir="ltr" />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field name="kind" label={t.kind} error={error('kind')} required>
            <Select
              name="kind"
              defaultValue={values.kind}
              options={applicationFormKind.enumValues.map((value) => ({
                value,
                label: t.kinds[value],
              }))}
            />
          </Field>
          <Field name="slug" label={t.slug} hint={t.slugHint} error={error('slug')} required>
            <Input name="slug" defaultValue={values.slug} dir="ltr" error={error('slug')} />
          </Field>
        </FieldRow>

        <Field name="vacancyId" label={t.linkedVacancy} hint={t.linkedVacancyHint}>
          <Select
            name="vacancyId"
            defaultValue={values.vacancyId ?? ''}
            placeholder={adminUi.list.all}
            options={vacancyOptions.map((option) => ({
              value: option.id,
              label: option.title,
            }))}
          />
        </Field>

        <RichTextEditor name="introAr" label={t.intro} defaultValue={values.introAr} />

        {/* The window and the cap. Grouped because the four together are one
            decision — "when is this open and for how many" — and reading them
            apart is how a form gets published with a cap of 1. */}
        <FieldRow>
          <Field name="opensAt" label={t.opensAt} hint={t.opensAtHint} error={error('opensAt')}>
            <Input
              name="opensAt"
              type="datetime-local"
              defaultValue={toLocalInput(values.opensAt)}
              dir="ltr"
            />
          </Field>
          <Field name="closesAt" label={t.closesAt} hint={t.closesAtHint} error={error('closesAt')}>
            <Input
              name="closesAt"
              type="datetime-local"
              defaultValue={toLocalInput(values.closesAt)}
              dir="ltr"
              error={error('closesAt')}
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field name="capacity" label={t.capacity} hint={t.capacityHint} error={error('capacity')}>
            <Input
              name="capacity"
              type="number"
              min={1}
              defaultValue={values.capacity ?? ''}
              dir="ltr"
            />
          </Field>
          <Field name="capacityRule" label={t.capacityRule}>
            <Select
              name="capacityRule"
              defaultValue={values.capacityRule}
              options={applicationCapacityRule.enumValues.map((value) => ({
                value,
                label: value === 'close' ? t.capacityRuleClose : t.capacityRuleWaitlist,
              }))}
            />
          </Field>
        </FieldRow>

        <Field
          name="retentionMonths"
          label={t.retentionMonths}
          hint={t.retentionHint}
          error={error('retentionMonths')}
        >
          <Input
            name="retentionMonths"
            type="number"
            min={1}
            max={60}
            defaultValue={values.retentionMonths}
            dir="ltr"
            required
          />
        </Field>

        <Checkbox
          name="requireConsent"
          label={t.requireConsent}
          hint={t.requireConsentHint}
          defaultChecked={values.requireConsent}
        />

        <Checkbox
          name="allowMultiplePerEmail"
          label={t.allowMultiple}
          defaultChecked={values.allowMultiplePerEmail}
        />

        <Field name="confirmationAr" label={t.confirmation}>
          <Textarea name="confirmationAr" rows={3} defaultValue={values.confirmationAr ?? ''} />
        </Field>

        <Field
          name="notifyEmails"
          label={t.notifyEmails}
          hint={t.notifyEmailsHint}
          error={error('notifyEmails')}
        >
          <Textarea
            name="notifyEmails"
            rows={3}
            dir="ltr"
            defaultValue={values.notifyEmails.join('\n')}
          />
        </Field>
      </Stack>

      <SaveBar pending={pending} />
    </form>
  );
}
