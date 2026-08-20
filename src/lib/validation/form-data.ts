import { formDataToObject } from './common';

/**
 * Turns an admin form's `FormData` into the object its Zod schema expects.
 *
 * Three conversions that a plain `Object.fromEntries` gets wrong, each of which
 * fails as a validation error on a field the editor filled in correctly:
 *
 * - **Repeated fields** (checkbox groups, multi-selects) collapse to their last
 *   value. `multi` collects them into arrays.
 * - **Rich text** arrives as a JSON string from the editor's hidden input and
 *   has to be parsed back into a document.
 * - **Unchecked checkboxes** are absent from `FormData` entirely, so a boolean
 *   that was switched off looks like "not submitted" rather than `false`.
 */
export type FormShape = {
  multi?: readonly string[];
  /** Fields whose value is a JSON document from the rich-text editor. */
  json?: readonly string[];
  booleans?: readonly string[];
  /** Fields that must become `undefined` rather than `''` when left blank. */
  nullable?: readonly string[];
};

export function parseAdminForm(formData: FormData, shape: FormShape): Record<string, unknown> {
  const out = formDataToObject(formData, shape.multi ?? []);

  for (const field of shape.json ?? []) {
    const raw = out[field];
    if (typeof raw !== 'string' || raw.trim() === '') {
      out[field] = null;
      continue;
    }
    try {
      out[field] = JSON.parse(raw);
    } catch {
      // A malformed document is dropped rather than passed on: Zod would reject
      // it anyway, and the editor's own content is the thing worth preserving,
      // not a half-serialised copy of it.
      out[field] = null;
    }
  }

  for (const field of shape.booleans ?? []) {
    out[field] = out[field] === 'on' || out[field] === 'true';
  }

  for (const field of shape.nullable ?? []) {
    if (out[field] === '') out[field] = null;
  }

  return out;
}
