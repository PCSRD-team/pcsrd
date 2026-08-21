import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { FieldErrors } from '@/lib/errors';
import type { Dictionary } from '@/lib/i18n/get-dictionary';

/**
 * The slice of the dictionary a form needs.
 *
 * These components run inside a Client Component (the form shell needs
 * `useActionState`), so whatever is passed here is serialised into the page.
 * Narrowing it to four sections keeps every other route's copy out of the
 * browser bundle.
 */
export type FormDict = Pick<Dictionary, 'common' | 'forms' | 'errors' | 'states'>;

/** Option label lookup, keyed by the schema value it labels. */
export type OptionLabels = Record<string, string>;

/**
 * Form fields.
 *
 * All Server Components. A form built from these submits with a plain POST when
 * JavaScript is unavailable, which is rule 7 — and on a slow or filtered
 * connection in Gaza that is not an edge case.
 *
 * Errors arrive as **dictionary keys** from the action, because the server has
 * no locale. Resolution happens here, at the last possible moment.
 */

/** Walks `errors.field.tooShort` to its string. Unknown keys render verbatim,
 *  which is visibly wrong rather than invisibly blank. */
export function resolveKey(dict: FormDict, key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], dict);
  return typeof value === 'string' ? value : key;
}

/**
 * The ids `FieldShell` renders, joined for `aria-describedby`.
 *
 * `FieldShell` centralised the *rendering* of hints and errors and left the
 * *association* to each control — so only `TextField` and `FileField` ever wired
 * it. `<textarea>` and `<select>` set `aria-invalid` and no `aria-describedby`,
 * which announces a field as invalid while giving no reason: worse than
 * silence. That covered `message`, `description`, `experience`, `motivation`,
 * `coverNote` and every enquiry, category and governorate select on the six
 * public forms — WCAG 2.2 SC 3.3.1 and SC 1.3.1.
 *
 * One helper rather than a repeated expression, because the repeated expression
 * is exactly what went missing.
 */
export function describedBy(name: string, hint: string | undefined, errors?: FieldErrors) {
  return (
    [hint ? `${name}-hint` : null, errors?.[name] ? `${name}-error` : null]
      .filter(Boolean)
      .join(' ') || undefined
  );
}

function FieldShell({
  name,
  label,
  hint,
  required,
  errors,
  dict,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  errors?: FieldErrors;
  dict: FormDict;
  children: ReactNode;
}) {
  const messages = errors?.[name] ?? [];

  return (
    <div className="space-y-2">
      <label htmlFor={name} className="block text-small font-medium text-ink">
        {label}
        {required ? (
          <span className="ms-1 text-gold-700" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ms-2 font-mono text-eyebrow text-mono-muted">
            {dict.common.optional}
          </span>
        )}
      </label>

      {hint ? (
        <p id={`${name}-hint`} className="text-caption text-ink-55">
          {hint}
        </p>
      ) : null}

      {children}

      {messages.length ? (
        <p id={`${name}-error`} className="text-caption text-gold-700" role="alert">
          {messages.map((key) => resolveKey(dict, key)).join(' ')}
        </p>
      ) : null}
    </div>
  );
}

const controlClass =
  'block w-full rule-control bg-paper px-4 py-3 text-small text-ink ' +
  'focus:border-navy-700';

export function TextField({
  name,
  label,
  dict,
  type = 'text',
  hint,
  required,
  errors,
  defaultValue,
  autoComplete,
  inputMode,
}: {
  name: string;
  label: string;
  dict: FormDict;
  type?: 'text' | 'email' | 'tel' | 'url' | 'date';
  hint?: string;
  required?: boolean;
  errors?: FieldErrors;
  defaultValue?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'url' | 'numeric';
}) {
  return (
    <FieldShell name={name} label={label} hint={hint} required={required} errors={errors} dict={dict}>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={errors?.[name] ? true : undefined}
        aria-describedby={describedBy(name, hint, errors)}
        // Latin text in an otherwise-RTL form: an email or a URL typed into a
        // right-aligned field is unreadable while being typed.
        dir={type === 'email' || type === 'url' || type === 'tel' ? 'ltr' : undefined}
        className={cn(controlClass, (type === 'email' || type === 'url' || type === 'tel') && 'text-start')}
      />
    </FieldShell>
  );
}

export function TextArea({
  name,
  label,
  dict,
  hint,
  required,
  errors,
  rows = 6,
  defaultValue,
}: {
  name: string;
  label: string;
  dict: FormDict;
  hint?: string;
  required?: boolean;
  errors?: FieldErrors;
  rows?: number;
  defaultValue?: string;
}) {
  return (
    <FieldShell name={name} label={label} hint={hint} required={required} errors={errors} dict={dict}>
      <textarea
        id={name}
        name={name}
        rows={rows}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={errors?.[name] ? true : undefined}
        aria-describedby={describedBy(name, hint, errors)}
        className={controlClass}
      />
    </FieldShell>
  );
}

export function SelectField({
  name,
  label,
  dict,
  options,
  required,
  errors,
  defaultValue,
  hint,
}: {
  name: string;
  label: string;
  dict: FormDict;
  options: { value: string; label: string }[];
  required?: boolean;
  errors?: FieldErrors;
  defaultValue?: string;
  hint?: string;
}) {
  return (
    <FieldShell name={name} label={label} hint={hint} required={required} errors={errors} dict={dict}>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ''}
        aria-invalid={errors?.[name] ? true : undefined}
        aria-describedby={describedBy(name, hint, errors)}
        className={controlClass}
      >
        <option value="" disabled>
          —
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxGroup({
  name,
  legend,
  options,
  errors,
  dict,
  required,
}: {
  name: string;
  legend: string;
  options: { value: string; label: string }[];
  errors?: FieldErrors;
  dict: FormDict;
  required?: boolean;
}) {
  const messages = errors?.[name] ?? [];
  return (
    <fieldset
      aria-invalid={messages.length ? true : undefined}
      aria-describedby={messages.length ? `${name}-error` : undefined}
    >
      <legend className="text-small font-medium text-ink">
        {legend}
        {required ? (
          <span className="ms-1 text-gold-700" aria-hidden="true">
            *
          </span>
        ) : null}
      </legend>
      <ul className="mbs-3 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <li key={option.value}>
            <label className="flex items-center gap-3 text-small text-ink">
              <input
                type="checkbox"
                name={name}
                value={option.value}
                className="size-4 accent-navy-700"
              />
              {option.label}
            </label>
          </li>
        ))}
      </ul>
      {messages.length ? (
        <p id={`${name}-error`} className="mbs-2 text-caption text-gold-700" role="alert">
          {messages.map((key) => resolveKey(dict, key)).join(' ')}
        </p>
      ) : null}
    </fieldset>
  );
}

export function FileField({
  name,
  label,
  dict,
  accept,
  hint,
  required,
  errors,
}: {
  name: string;
  label: string;
  dict: FormDict;
  accept?: string;
  hint?: string;
  required?: boolean;
  errors?: FieldErrors;
}) {
  return (
    <FieldShell name={name} label={label} hint={hint} required={required} errors={errors} dict={dict}>
      <input
        id={name}
        name={name}
        type="file"
        accept={accept}
        required={required}
        aria-invalid={errors?.[name] ? true : undefined}
        aria-describedby={
          [hint ? `${name}-hint` : null, errors?.[name] ? `${name}-error` : null]
            .filter(Boolean)
            .join(' ') || undefined
        }
        className="block w-full text-small text-ink file:me-4 file:rule-edge file:bg-paper-alt file:px-4 file:py-2 file:text-small file:text-ink"
      />
    </FieldShell>
  );
}

/**
 * The honeypot.
 *
 * Hidden from the viewport **and** from the accessibility tree, so a screen
 * reader never announces it and a sighted user never sees it. `tabIndex={-1}`
 * and `autoComplete="off"` keep a browser's autofill from filling it in and
 * turning a real submission into a silent discard.
 */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -inset-x-[9999px] size-px overflow-hidden">
      <label htmlFor="website">Website</label>
      <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

/** The reference number panel shown after a successful submission. */
export function SubmissionReceipt({
  reference,
  dict,
}: {
  reference: string;
  dict: FormDict;
}) {
  return (
    <div className="rule-edge border-gold-600 bg-gold-050 p-6" role="status">
      <p className="text-small font-medium text-ink">{dict.forms.successWithReference}</p>
      <p className="mbs-3 font-mono text-h3 text-ink" dir="ltr">
        {reference}
      </p>
      <p className="mbs-3 text-caption text-ink-70">{dict.forms.keepReference}</p>
    </div>
  );
}
