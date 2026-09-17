import type { FormDict, OptionLabels } from '@/components/forms/fields';
import type { Dictionary } from './get-dictionary';

/**
 * Narrows a dictionary for a Client Component form.
 *
 * The form shell needs `useActionState`, so it and everything it renders are
 * client code, and every prop crosses the serialisation boundary into the HTML.
 * Passing the whole dictionary would ship every route's copy — both locales'
 * worth of navigation, programme and legal strings — to a visitor filling in a
 * contact form.
 */
export function formSlice(dict: Dictionary): FormDict {
  return {
    common: dict.common,
    forms: dict.forms,
    errors: dict.errors,
    states: dict.states,
    formsUi: dict.formsUi,
  };
}

/**
 * Flattens the option labels the forms need into one lookup.
 *
 * Values come from the Zod schemas; only the labels come from here, so a value
 * the server would reject cannot appear in a `<select>`.
 */
export function optionLabels(dict: Dictionary): OptionLabels {
  return {
    ...dict.formOptions,
    ...dict.enums.governorate,
    ...dict.enums.program,
    ...dict.enums.theme,
  };
}
