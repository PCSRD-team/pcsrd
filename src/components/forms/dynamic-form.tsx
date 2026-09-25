'use client';
// Client Component for one reason: `FormShell` is, because `useActionState` is
// the only way React hands an action's result back to a form — with JavaScript
// and without it. Every field below is rendered from the same server-safe kit
// the six fixed forms use, and a plain POST without scripting produces the same
// markup, the same errors and the same receipt.

import type { ReactNode } from 'react';
import type { PublicForm, PublicFormField } from '@/db/queries/applications';
import { CONSENT_FIELD_KEY } from '@/lib/applications/answer-schema';
import { ACCEPT_ATTRIBUTE } from '@/lib/applications/attachment-kinds';
import { submitApplicationForm } from '@/actions/public/apply';
import { Checkbox, RadioGroup } from '@/components/ui/inputs';
import { SubmissionReceipt } from '@/components/ui/feedback';
import { Notice } from '@/components/ui/notice';
import { Eyebrow } from '@/components/ui/typography';
import {
  CheckboxGroup,
  type FieldState,
  FileField,
  type FormDict,
  SelectField,
  TextArea,
  TextField,
  resolveErrors,
} from './fields';
import { FormShell } from './form-shell';

/**
 * Renders an admin-built form.
 *
 * Every control comes from `./fields`, which is the same wrapper set behind the
 * contact form and the complaints channel. Nothing here draws its own input, so
 * a form built in the admin gets the kit's label/hint/error id contract, its
 * focus handling and its RTL behaviour for free — and cannot drift from them.
 *
 * Three things this does that a static form does not have to:
 *
 * - **`visibleWhen` is not evaluated here.** The server decides what was
 *   required and what was ignored (`parseAnswers`), and it decides it against
 *   the values actually submitted. Hiding a field in the browser as well would
 *   need client state, would disagree with the server the moment JavaScript is
 *   off, and would put the rule in two places. Instead the condition is
 *   *described* under the field, so a visitor reads "answer this if you ticked
 *   the box above" rather than watching a field appear.
 *
 * - **`section` renders a heading, not a control.** It is how a forty-field
 *   form stops being forty inputs in a column.
 *
 * - **The consent tick is synthetic when the form declares no consent field.**
 *   It is rendered from `form.requireConsent` rather than from a row, so a
 *   consent gate cannot be removed by deleting a field.
 */

export type DynamicFormProps = {
  form: PublicForm;
  dict: FormDict;
  locale: 'ar' | 'en';
  /** `apply` namespace copy, resolved by the page. */
  copy: {
    submit: string;
    consentLabel: string;
    consentHelp: string;
    retentionNotice: string;
    waitlistNotice: string;
    successWaitlisted: string;
    filesHint: string;
  };
  /** Shown above the fields — the deadline, the places left, the waitlist warning. */
  notice?: ReactNode;
  /** True when the cap is reached and the form's rule is `waitlist`. */
  waitlisting?: boolean;
};

/** Describes a condition in words, since the field is always rendered. */
function conditionHint(field: PublicFormField, form: PublicForm): string | undefined {
  const condition = field.visibleWhen;
  if (!condition) return undefined;
  const controller = form.fields.find((candidate) => candidate.key === condition.field);
  if (!controller) return undefined;

  const values = condition.equals
    .map((value) => controller.options.find((option) => option.value === value)?.label ?? value)
    .join('، ');

  return `${controller.label}: ${values}`;
}

function renderField(field: PublicFormField, form: PublicForm, dict: FormDict, state: FieldState) {
  const hint = [field.help, conditionHint(field, form)].filter(Boolean).join(' — ') || undefined;
  const common = {
    name: field.key,
    label: field.label,
    dict,
    hint,
    required: field.required,
    state,
  };

  switch (field.type) {
    case 'section':
      // A heading inside the field flow. `<Eyebrow>` is the mono eyebrow the
      // design system uses for section marks; the rule beneath it is the 2px
      // ink section boundary, which is the only weight allowed to separate
      // parts of one page.
      return (
        <div key={field.id} className="mbs-4 border-bs-2 border-ink pbs-6 first:mbs-0 first:border-bs-0 first:pbs-0">
          <Eyebrow>{field.label}</Eyebrow>
          {field.help ? <p className="mbs-2 text-caption text-ink-70">{field.help}</p> : null}
        </div>
      );

    case 'long_text':
      return <TextArea key={field.id} {...common} rows={5} />;

    case 'email':
      return <TextField key={field.id} {...common} type="email" inputMode="email" autoComplete="email" />;

    case 'phone':
      return <TextField key={field.id} {...common} type="tel" inputMode="tel" autoComplete="tel" />;

    case 'date':
      return <TextField key={field.id} {...common} type="date" />;

    case 'number':
      return <TextField key={field.id} {...common} inputMode="numeric" />;

    case 'radio':
      // Radios, not checkboxes. `radio` and `multi_select` differ in what they
      // post — one value against many — and the validator compiled from the
      // field row expects a single string here. Rendering a checkbox group
      // would let an applicant tick three boxes and have the submission
      // refused as an invalid choice, with nothing on screen explaining why.
      return (
        <RadioGroup
          key={field.id}
          name={field.key}
          legend={field.label}
          hint={hint}
          required={field.required}
          optionalLabel={dict.common.optional}
          error={resolveErrors(dict, state.errors, field.key)}
          options={field.options}
          defaultValue={
            typeof state.values?.[field.key] === 'string'
              ? (state.values[field.key] as string)
              : undefined
          }
          columns={field.options.length > 4 ? 2 : 1}
        />
      );

    case 'select':
      return <SelectField key={field.id} {...common} options={field.options} />;

    case 'multi_select':
      return (
        <CheckboxGroup
          key={field.id}
          name={field.key}
          legend={field.label}
          hint={hint}
          required={field.required}
          dict={dict}
          state={state}
          options={field.options}
          columns={field.options.length > 4 ? 2 : 1}
        />
      );

    case 'checkbox':
      // Not wrapped in `Field`: a checkbox's label sits beside the box rather
      // than above it, and the kit's `Checkbox` owns its own label, hint and
      // error for exactly that reason.
      return (
        <Checkbox
          key={field.id}
          name={field.key}
          label={field.label}
          hint={hint}
          error={resolveErrors(dict, state.errors, field.key)}
          required={field.required}
          defaultChecked={state.values?.[field.key] === 'on'}
        />
      );

    case 'file':
      return (
        <FileField
          key={field.id}
          {...common}
          accept={ACCEPT_ATTRIBUTE[field.config.accept ?? 'document']}
        />
      );

    case 'short_text':
    default:
      return <TextField key={field.id} {...common} />;
  }
}

export function DynamicApplicationForm({
  form,
  dict,
  locale,
  copy,
  notice,
  waitlisting,
}: DynamicFormProps) {
  const hasOwnConsentField = form.fields.some((field) => field.key === CONSENT_FIELD_KEY);
  const hasFiles = form.fields.some((field) => field.type === 'file');

  return (
    <FormShell<{ reference: string; waitlisted: boolean }>
      action={submitApplicationForm}
      dict={dict}
      locale={locale}
      submitLabel={copy.submit}
      intro={
        <>
          {notice}
          {waitlisting ? <Notice tone="warning">{copy.waitlistNotice}</Notice> : null}
        </>
      }
      renderReceipt={(data) => (
        <SubmissionReceipt
          title={
            data.waitlisted ? copy.successWaitlisted : dict.forms.successWithReference
          }
          reference={data.reference}
          body={dict.forms.keepReference}
        />
      )}
    >
      {(state) => (
        <>
          {/* The slug travels with the submission: the action re-reads the
              form from the database rather than trusting anything about its
              shape from the client. */}
          <input type="hidden" name="formSlug" value={form.slug} />

          {form.fields.map((field) => renderField(field, form, dict, state))}

          {hasFiles ? <p className="text-caption text-ink-70">{copy.filesHint}</p> : null}

          {/* Synthetic, and only when the form declares no consent field of
              its own. Rendered last, immediately above the submit, where a
              consent tick belongs. */}
          {form.requireConsent && !hasOwnConsentField ? (
            <Checkbox
              name={CONSENT_FIELD_KEY}
              label={copy.consentLabel}
              hint={copy.consentHelp}
              error={resolveErrors(dict, state.errors, CONSENT_FIELD_KEY)}
              required
            />
          ) : null}

          <p className="text-caption text-ink-55">{copy.retentionNotice}</p>
        </>
      )}
    </FormShell>
  );
}
