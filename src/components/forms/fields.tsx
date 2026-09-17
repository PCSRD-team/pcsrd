import type { FieldErrors } from '@/lib/errors';
import type { Dictionary } from '@/lib/i18n/get-dictionary';
import type { FormValues } from '@/lib/validation/common';
import { Field, describedBy as kitDescribedBy } from '@/components/ui/field';
import {
  CheckboxGroup as KitCheckboxGroup,
  FileInput,
  Honeypot,
  Input,
  type Option,
  Select,
  Textarea,
} from '@/components/ui/inputs';

/**
 * The slice of the dictionary a form needs.
 *
 * These components render inside the form shell, which is a Client Component
 * (it needs `useActionState`), so whatever is passed here is serialised into
 * the page. Narrowing it to five sections keeps every other route's copy out
 * of the browser bundle.
 */
export type FormDict = Pick<Dictionary, 'common' | 'forms' | 'errors' | 'states' | 'formsUi'>;

/** Option label lookup, keyed by the schema value it labels. */
export type OptionLabels = Record<string, string>;

/**
 * What a failed submission leaves behind for the next render: the errors per
 * field, as dictionary keys, and the values the visitor typed. The shell
 * builds one of these and each field reads its own entry.
 */
export type FieldState = {
  errors?: FieldErrors;
  values?: FormValues;
};

/**
 * Form fields — thin wrappers over the kit.
 *
 * The kit (`@/components/ui/field`, `inputs`) owns the markup, the `control`
 * styling and the id contract (`name`, `name-hint`, `name-error`). What these
 * add is the dictionary layer: errors arrive from the action as **keys**,
 * because the server has no locale, and are resolved here at the last
 * possible moment; and a failed submission's `values` are threaded back into
 * `defaultValue` so a plain POST without JavaScript re-renders the form with
 * what the visitor typed — rule 7.
 *
 * Nothing here is a Client Component. A form built from these submits with a
 * plain POST when JavaScript is unavailable, and on a slow or filtered
 * connection in Gaza that is not an edge case.
 */

/** Walks `errors.field.tooShort` to its string. Unknown keys render verbatim,
 *  which is visibly wrong rather than invisibly blank. */
export function resolveKey(dict: FormDict, key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], dict);
  return typeof value === 'string' ? value : key;
}

/** The field's errors as rendered text, or `undefined` when it has none. */
export function resolveErrors(
  dict: FormDict,
  errors: FieldErrors | undefined,
  name: string,
): string[] | undefined {
  const keys = errors?.[name];
  if (!keys?.length) return undefined;
  return keys.map((key) => resolveKey(dict, key));
}

/**
 * The ids the kit `Field` renders, joined for `aria-describedby`. Kept for
 * callers that wire a custom control; the wrappers below get it from the kit.
 */
export function describedBy(name: string, hint: string | undefined, errors?: FieldErrors) {
  return kitDescribedBy(name, hint, errors?.[name]);
}

/**
 * The field that should receive focus after a failed submission: the first
 * one with an error, in the order the schema reported them — which is the
 * order the fields are declared. Rendered as `autoFocus`, which React emits
 * as the `autofocus` attribute on the server, so a no-JavaScript re-render
 * lands the visitor on the problem. With JavaScript on, the element already
 * exists and React does not re-focus it; focus stays on the submit button,
 * which is also acceptable.
 */
export function firstErrorField(errors: FieldErrors | undefined): string | undefined {
  if (!errors) return undefined;
  return Object.keys(errors).find((key) => key !== '_form' && errors[key]?.length);
}

function stringValue(values: FormValues | undefined, name: string): string | undefined {
  const value = values?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function listValue(values: FormValues | undefined, name: string): string[] | undefined {
  const value = values?.[name];
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

/** What every wrapper below has in common. */
type FieldProps = {
  name: string;
  label: string;
  dict: FormDict;
  hint?: string;
  required?: boolean;
  state?: FieldState;
};

/** The three things a wrapper derives from `state` for its `name`. */
function fieldBits({ name, dict, state, hint }: FieldProps) {
  return {
    error: resolveErrors(dict, state?.errors, name),
    autoFocus: firstErrorField(state?.errors) === name || undefined,
    hint,
  };
}

export function TextField({
  type = 'text',
  defaultValue,
  autoComplete,
  inputMode,
  ...props
}: FieldProps & {
  type?: 'text' | 'email' | 'tel' | 'url' | 'date';
  defaultValue?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'url' | 'numeric';
}) {
  const { name, label, dict, required, state } = props;
  const { error, hint, autoFocus } = fieldBits(props);
  return (
    <Field
      name={name}
      label={label}
      hint={hint}
      error={error}
      required={required}
      optionalLabel={dict.common.optional}
    >
      <Input
        name={name}
        type={type}
        hint={hint}
        error={error}
        required={required}
        defaultValue={stringValue(state?.values, name) ?? defaultValue}
        autoComplete={autoComplete}
        inputMode={inputMode}
        autoFocus={autoFocus}
      />
    </Field>
  );
}

export function TextArea({
  rows = 6,
  defaultValue,
  ...props
}: FieldProps & { rows?: number; defaultValue?: string }) {
  const { name, label, dict, required, state } = props;
  const { error, hint, autoFocus } = fieldBits(props);
  return (
    <Field
      name={name}
      label={label}
      hint={hint}
      error={error}
      required={required}
      optionalLabel={dict.common.optional}
    >
      <Textarea
        name={name}
        rows={rows}
        hint={hint}
        error={error}
        required={required}
        defaultValue={stringValue(state?.values, name) ?? defaultValue}
        autoFocus={autoFocus}
      />
    </Field>
  );
}

export function SelectField({
  options,
  defaultValue,
  ...props
}: FieldProps & { options: Option[]; defaultValue?: string }) {
  const { name, label, dict, required, state } = props;
  const { error, hint, autoFocus } = fieldBits(props);
  return (
    <Field
      name={name}
      label={label}
      hint={hint}
      error={error}
      required={required}
      optionalLabel={dict.common.optional}
    >
      <Select
        name={name}
        options={options}
        hint={hint}
        error={error}
        required={required}
        defaultValue={stringValue(state?.values, name) ?? defaultValue}
        autoFocus={autoFocus}
      />
    </Field>
  );
}

/**
 * Several boxes under one name. The kit's `CheckboxGroup` owns the fieldset,
 * legend and group error; this resolves the keys and restores the ticks.
 * `autoFocus` has no single control to land on, so the group error's
 * `role="alert"` carries the announcement instead.
 */
export function CheckboxGroup({
  legend,
  options,
  columns,
  ...props
}: Omit<FieldProps, 'label'> & { legend: string; options: Option[]; columns?: 1 | 2 }) {
  const { name, dict, required, state } = props;
  const { error, hint } = fieldBits({ ...props, label: legend });
  return (
    <KitCheckboxGroup
      name={name}
      legend={legend}
      options={options}
      hint={hint}
      error={error}
      required={required}
      optionalLabel={dict.common.optional}
      defaultValue={listValue(state?.values, name)}
      columns={columns}
    />
  );
}

/**
 * A file input. Nothing is restored after a failure — a browser will not
 * re-fill a file input from markup — so when the form comes back with errors
 * the hint says to choose the file again.
 */
export function FileField({ accept, ...props }: FieldProps & { accept?: string }) {
  const { name, label, dict, required, state } = props;
  const { error, autoFocus } = fieldBits(props);
  const hint = state?.errors
    ? [props.hint, dict.formsUi.reselectFile].filter(Boolean).join(' ')
    : props.hint;
  return (
    <Field
      name={name}
      label={label}
      hint={hint}
      error={error}
      required={required}
      optionalLabel={dict.common.optional}
    >
      <FileInput
        name={name}
        accept={accept}
        hint={hint}
        error={error}
        required={required}
        autoFocus={autoFocus}
      />
    </Field>
  );
}

export { Honeypot };
