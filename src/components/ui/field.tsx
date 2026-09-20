import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './icon';

/**
 * Field scaffolding, shared by the public forms and the admin.
 *
 * All Server Components. A form built from these submits with a plain POST
 * when JavaScript is unavailable, which is non-negotiable #7 — and on a slow
 * or filtered connection in Gaza that is not an edge case.
 *
 * The contract between a `Field` and the control inside it is three ids:
 *
 *   `${name}`        the control — `<label htmlFor>` points here
 *   `${name}-hint`   the help line, when there is one
 *   `${name}-error`  the error line, when there is one
 *
 * `describedBy()` joins the last two for `aria-describedby`. The control
 * sets `aria-invalid` itself, and the `control` utility styles that
 * attribute — so a field cannot *look* invalid without also being announced
 * as invalid (SC 3.3.1, SC 1.3.1).
 *
 * Errors arrive already resolved to strings. The public forms receive
 * dictionary keys from the action and resolve them before rendering; the
 * admin receives Arabic strings. Neither concern belongs here.
 */

/**
 * The ids a `Field` renders, joined for `aria-describedby`.
 *
 * Both arguments are checked for truthiness only, so the public forms can
 * pass `errors?.[name]` (a `string[]`) and the admin can pass `error` (a
 * `string`) without adapting.
 */
export function describedBy(name: string, hint?: unknown, error?: unknown): string | undefined {
  return (
    [present(hint) ? `${name}-hint` : null, present(error) ? `${name}-error` : null]
      .filter(Boolean)
      .join(' ') || undefined
  );
}

/** Truthy, and not an empty array — `errors[name]` can be `[]`. */
function present(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(Boolean);
  return Boolean(value);
}

/** Normalises the two error shapes the forms produce into one line of text. */
export function errorText(error: string | string[] | null | undefined): string | undefined {
  if (!error) return undefined;
  const text = Array.isArray(error) ? error.filter(Boolean).join(' ') : error;
  return text || undefined;
}

const styles = {
  field: 'space-y-2',
  // A `<label for>` focuses the control it names, so it is a target and says
  // so — the UA gives a label no cursor of its own. Stated here once for every
  // field in the site and the admin.
  label: 'block w-fit cursor-pointer text-small font-medium text-ink',
  required: 'ms-1 text-destructive',
  optional: 'ms-2 font-mono text-eyebrow text-mono-muted',
  hint: 'text-caption text-ink-55',
  error: 'flex items-start gap-1.5 text-caption text-destructive',
  legend: 'text-small font-medium text-ink',
};

/** The asterisk after a required label. Decorative: `required` on the control carries the semantics. */
export function RequiredMark() {
  return (
    <span className={styles.required} aria-hidden="true">
      *
    </span>
  );
}

/**
 * The error line under a control. A glyph and a word, never colour alone.
 * `role="alert"` so a server-rendered error after a failed submit is read
 * out when the page replaces itself.
 */
export function FieldError({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p id={id} role="alert" className={cn(styles.error, className)}>
      <span className="mbs-0.5 shrink-0">
        <Icon name="error" size={16} />
      </span>
      <span>{children}</span>
    </p>
  );
}

export function FieldHint({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p id={id} className={cn(styles.hint, className)}>
      {children}
    </p>
  );
}

/**
 * Label + hint + control + error.
 *
 * `optionalLabel` is the dictionary's "optional" — rendered when the field
 * is not required, because on a form where most fields are required the
 * marked ones are the exceptions. Omit it and nothing is rendered.
 */
export function Field({
  name,
  label,
  hint,
  error,
  required,
  optionalLabel,
  children,
  className,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string | string[] | null;
  required?: boolean;
  optionalLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  const message = errorText(error);
  return (
    <div className={cn(styles.field, className)}>
      <label htmlFor={name} className={styles.label}>
        {label}
        {required ? (
          <RequiredMark />
        ) : optionalLabel ? (
          <span className={styles.optional}>{optionalLabel}</span>
        ) : null}
      </label>
      {hint ? <FieldHint id={`${name}-hint`}>{hint}</FieldHint> : null}
      {children}
      {message ? <FieldError id={`${name}-error`}>{message}</FieldError> : null}
    </div>
  );
}

/**
 * A group of related controls — a checkbox group, a radio group, an
 * address. The legend is the group's accessible name; `aria-describedby`
 * on the fieldset carries the group error.
 */
export function Fieldset({
  name,
  legend,
  hint,
  error,
  required,
  optionalLabel,
  children,
  className,
  disabled,
}: {
  name: string;
  legend: string;
  hint?: string;
  error?: string | string[] | null;
  required?: boolean;
  optionalLabel?: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const message = errorText(error);
  return (
    <fieldset
      disabled={disabled}
      aria-invalid={message ? true : undefined}
      aria-describedby={describedBy(name, hint, message)}
      className={cn('min-w-0', className)}
    >
      <Legend>
        {legend}
        {required ? (
          <RequiredMark />
        ) : optionalLabel ? (
          <span className={styles.optional}>{optionalLabel}</span>
        ) : null}
      </Legend>
      {hint ? (
        <FieldHint id={`${name}-hint`} className="mbs-1">
          {hint}
        </FieldHint>
      ) : null}
      <div className="mbs-3">{children}</div>
      {message ? (
        <FieldError id={`${name}-error`} className="mbs-2">
          {message}
        </FieldError>
      ) : null}
    </fieldset>
  );
}

export function Legend({ children, className }: { children: ReactNode; className?: string }) {
  return <legend className={cn(styles.legend, className)}>{children}</legend>;
}

/**
 * The layout of a form: fields stacked with one rhythm, actions at the
 * end. `<form>` itself stays at the call site — it owns `action`,
 * `noValidate` and the hidden fields.
 */
export function FormStack({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'fieldset';
}) {
  return <Tag className={cn('grid gap-6', className)}>{children}</Tag>;
}

/** Two fields side by side from `sm`; stacked on the phone. */
export function FieldRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-6 sm:grid-cols-2', className)}>{children}</div>;
}

/** The actions row at the end of a form. */
export function FormActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 border-bs border-rule pbs-6', className)}>
      {children}
    </div>
  );
}
