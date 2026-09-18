import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { describedBy, errorText, Fieldset } from './field';

/**
 * Form controls.
 *
 * Native elements, styled by the `control` utilities in globals.css: 1px
 * `rule-control` edge, radius 0, white ground, 44px tall. No JavaScript —
 * a `<select>` is a `<select>`, a checkbox is a checkbox, and every one of
 * them posts with the form when scripting is off.
 *
 * Each control derives its `id`, `aria-invalid` and `aria-describedby` from
 * `name` + `hint` + `error`, the same three things the `Field` around it
 * renders, so the association cannot drift. Pass `hint` and `error` to both
 * — the field renders them, the control references them.
 *
 * Two escapes from that derivation, both of them load-bearing:
 *
 * `id` **wins over the id derived from `name`**. A repeated row posts the
 * same name once per row (a `role` select per user), and a field whose ids
 * come from `useId()` cannot name itself after the field it posts. Without
 * the override those screens produce duplicate ids, which is a WCAG 4.1.1
 * failure and silently mis-targets every `<label for>` after the first.
 *
 * `name` is **optional**. A control that must not be posted — a search box
 * inside a content form, a channel row that travels as one hidden JSON
 * input — is still a control and still deserves the field contract. Omitting
 * `name` is how a call site says "this value is not part of the request";
 * it is not an oversight, and giving such a control a name would silently
 * add a field to the submission.
 */

/** Text typed left-to-right whatever the page direction: an address, a URL, a number. */
const latinTypes = new Set(['email', 'url', 'tel', 'number', 'password']);

type CommonControl = {
  /** The posted field name. Omit for a control that is deliberately not posted. */
  name?: string;
  /** Overrides the id derived from `name`. Pass it whenever `name` is absent or repeated. */
  id?: string;
  /** Truthy when the field renders a hint; only the id is derived from it. */
  hint?: unknown;
  /** The error, or errors, the field renders. */
  error?: string | string[] | null;
  className?: string;
};

/**
 * The id the field contract hangs off: the explicit one, else the name.
 * `undefined` when a control has neither — a self-labelling checkbox, say —
 * in which case nothing that needs an id is rendered at all.
 */
function controlIdOf(id: string | undefined, name: string | undefined) {
  return id ?? name;
}

// ── Input ────────────────────────────────────────────────────────────────

type NativeInput = Omit<
  ComponentPropsWithoutRef<'input'>,
  'name' | 'className' | 'id' | 'aria-invalid' | 'aria-describedby'
>;

export function Input({
  name,
  id,
  hint,
  error,
  className,
  type = 'text',
  dir,
  ...rest
}: NativeInput & CommonControl) {
  const message = errorText(error);
  const latin = latinTypes.has(type);
  const controlId = controlIdOf(id, name);
  return (
    <input
      {...rest}
      id={controlId}
      name={name}
      type={type}
      // Latin text in an otherwise-RTL form: an email or a URL typed into a
      // right-aligned field is unreadable while being typed.
      dir={dir ?? (latin ? 'ltr' : undefined)}
      aria-invalid={message ? true : undefined}
      aria-describedby={controlId ? describedBy(controlId, hint, message) : undefined}
      className={cn('control', latin && 'text-start', className)}
    />
  );
}

// ── Textarea ─────────────────────────────────────────────────────────────

type NativeTextarea = Omit<
  ComponentPropsWithoutRef<'textarea'>,
  'name' | 'className' | 'id' | 'aria-invalid' | 'aria-describedby'
>;

export function Textarea({
  name,
  id,
  hint,
  error,
  className,
  rows = 6,
  ...rest
}: NativeTextarea & CommonControl) {
  const message = errorText(error);
  const controlId = controlIdOf(id, name);
  return (
    <textarea
      {...rest}
      id={controlId}
      name={name}
      rows={rows}
      aria-invalid={message ? true : undefined}
      aria-describedby={controlId ? describedBy(controlId, hint, message) : undefined}
      className={cn('control min-h-32 resize-y', className)}
    />
  );
}

// ── Select ───────────────────────────────────────────────────────────────

export type Option = { value: string; label: string; disabled?: boolean };

type NativeSelect = Omit<
  ComponentPropsWithoutRef<'select'>,
  'name' | 'className' | 'id' | 'aria-invalid' | 'aria-describedby' | 'children'
>;

/**
 * `placeholder` is the disabled first option ("—" or "Choose…"), rendered
 * for single selects only. A `multiple` select shows up to six rows and
 * posts one value per selected option under the same name.
 */
export function Select({
  name,
  id,
  hint,
  error,
  className,
  options,
  placeholder = '—',
  multiple,
  value,
  defaultValue,
  required,
  ...rest
}: NativeSelect & CommonControl & { options: Option[]; placeholder?: string | null }) {
  const message = errorText(error);
  const controlId = controlIdOf(id, name);
  return (
    <select
      {...rest}
      id={controlId}
      name={name}
      multiple={multiple}
      required={required}
      value={value}
      // A single select falls back to the empty placeholder option so it opens
      // on "—" rather than the first real choice. A *controlled* select gets
      // neither fallback: React refuses `value` and `defaultValue` together.
      defaultValue={value === undefined ? (defaultValue ?? (multiple ? undefined : '')) : undefined}
      size={multiple ? Math.min(Math.max(options.length, 2), 6) : undefined}
      aria-invalid={message ? true : undefined}
      aria-describedby={controlId ? describedBy(controlId, hint, message) : undefined}
      className={cn('control', className)}
    >
      {!multiple && placeholder !== null ? (
        <option value="" disabled={required}>
          {placeholder}
        </option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

// ── Checkbox / Radio ─────────────────────────────────────────────────────

type NativeChoice = Omit<
  ComponentPropsWithoutRef<'input'>,
  'name' | 'className' | 'id' | 'type' | 'aria-describedby' | 'children'
>;

/**
 * A single checkbox with its own label — a consent, a "featured" flag. Not
 * wrapped in `Field`: the label sits beside the box, not above it. `hint`
 * here is the text itself, rendered under the label.
 */
export function Checkbox({
  name,
  label,
  hint,
  error,
  className,
  id,
  ...rest
}: NativeChoice & {
  /** Omit for a controlled box that is not posted — a row toggle behind a JSON field. */
  name?: string;
  label: ReactNode;
  hint?: string;
  error?: string | string[] | null;
  className?: string;
  /** Defaults to `name`; pass when several boxes share a name. */
  id?: string;
}) {
  const controlId = controlIdOf(id, name);
  const message = errorText(error);
  return (
    <div className={cn('space-y-1', className)}>
      <label className="flex min-h-target items-start gap-3 py-2 text-small text-ink">
        <input
          {...rest}
          id={controlId}
          name={name}
          type="checkbox"
          aria-invalid={message ? true : undefined}
          aria-describedby={controlId ? describedBy(controlId, hint, message) : undefined}
          className="control-choice mbs-1"
        />
        <span>{label}</span>
      </label>
      {hint ? (
        <p id={controlId ? `${controlId}-hint` : undefined} className="ps-8 text-caption text-ink-55">
          {hint}
        </p>
      ) : null}
      {message ? (
        <p
          id={controlId ? `${controlId}-error` : undefined}
          role="alert"
          className="ps-8 text-caption text-destructive"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** The option rows a checkbox or radio group renders. */
function ChoiceList({
  name,
  type,
  options,
  defaultValue,
  columns,
  disabled,
}: {
  name: string;
  type: 'checkbox' | 'radio';
  options: Option[];
  defaultValue?: string | string[];
  columns?: 1 | 2;
  disabled?: boolean;
}) {
  const selected = new Set(
    Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : [],
  );
  return (
    <ul className={cn('grid gap-1', columns === 2 && 'sm:grid-cols-2')}>
      {options.map((option) => (
        <li key={option.value}>
          <label className="flex min-h-target items-center gap-3 py-2 text-small text-ink">
            <input
              type={type}
              name={name}
              value={option.value}
              defaultChecked={selected.has(option.value)}
              disabled={disabled || option.disabled}
              className="control-choice"
            />
            {option.label}
          </label>
        </li>
      ))}
    </ul>
  );
}

/**
 * Several boxes under one name — the form posts one value per checked box.
 * A `Fieldset` owns the legend, hint and error.
 */
export function CheckboxGroup({
  name,
  legend,
  options,
  hint,
  error,
  required,
  optionalLabel,
  defaultValue,
  columns = 2,
  className,
  disabled,
}: {
  name: string;
  legend: string;
  options: Option[];
  hint?: string;
  error?: string | string[] | null;
  required?: boolean;
  optionalLabel?: string;
  defaultValue?: string[];
  columns?: 1 | 2;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Fieldset
      name={name}
      legend={legend}
      hint={hint}
      error={error}
      required={required}
      optionalLabel={optionalLabel}
      className={className}
      disabled={disabled}
    >
      <ChoiceList
        name={name}
        type="checkbox"
        options={options}
        defaultValue={defaultValue}
        columns={columns}
      />
    </Fieldset>
  );
}

/** One of several — a radio group. Same contract as `CheckboxGroup`. */
export function RadioGroup({
  name,
  legend,
  options,
  hint,
  error,
  required,
  optionalLabel,
  defaultValue,
  columns = 1,
  className,
  disabled,
}: {
  name: string;
  legend: string;
  options: Option[];
  hint?: string;
  error?: string | string[] | null;
  required?: boolean;
  optionalLabel?: string;
  defaultValue?: string;
  columns?: 1 | 2;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Fieldset
      name={name}
      legend={legend}
      hint={hint}
      error={error}
      required={required}
      optionalLabel={optionalLabel}
      className={className}
      disabled={disabled}
    >
      <ChoiceList
        name={name}
        type="radio"
        options={options}
        defaultValue={defaultValue}
        columns={columns}
      />
    </Fieldset>
  );
}

// ── File ─────────────────────────────────────────────────────────────────

/**
 * A native file input. The 4 MB cap is enforced in the Zod schema, the route
 * handler and the bucket; the input only narrows `accept`. The chosen
 * file's name is Latin more often than not, so the control is LTR.
 */
export function FileInput({
  name,
  id,
  hint,
  error,
  className,
  accept,
  ...rest
}: Omit<NativeInput, 'type' | 'dir'> & CommonControl) {
  const message = errorText(error);
  const controlId = controlIdOf(id, name);
  return (
    <input
      {...rest}
      id={controlId}
      name={name}
      type="file"
      accept={accept}
      dir="ltr"
      aria-invalid={message ? true : undefined}
      aria-describedby={controlId ? describedBy(controlId, hint, message) : undefined}
      className={cn('control-file text-start', className)}
    />
  );
}

/**
 * The honeypot.
 *
 * Hidden from the viewport **and** from the accessibility tree, so a screen
 * reader never announces it and a sighted user never sees it. `tabIndex={-1}`
 * and `autoComplete="off"` keep a browser's autofill from filling it in and
 * turning a real submission into a silent discard. The field name is the
 * caller's so the action and the form agree on it.
 */
export function Honeypot({ name = 'website' }: { name?: string }) {
  return (
    <div aria-hidden="true" className="absolute -inset-x-[9999px] size-px overflow-hidden">
      <label htmlFor={name}>{name}</label>
      <input id={name} name={name} type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}
