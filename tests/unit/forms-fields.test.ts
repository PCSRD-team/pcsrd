import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CheckboxGroup,
  FileField,
  type FieldState,
  type FormDict,
  SelectField,
  TextArea,
  TextField,
  firstErrorField,
  resolveErrors,
  resolveKey,
} from '@/components/forms/fields';

/**
 * The public-form wrappers over the kit: dictionary keys resolve to copy, a
 * failed submission's values come back as `defaultValue`, and the first
 * failing field carries `autofocus` in the server markup — the whole of the
 * no-JavaScript retry path, rendered statically because that is how it ships.
 */

const dict = {
  common: { optional: 'اختياري' },
  forms: { name: 'الاسم' },
  errors: {
    validation: 'تحقّق من الحقول المميّزة.',
    field: { required: 'هذا الحقل مطلوب.', tooShort: 'النص أقصر من المطلوب.' },
  },
  states: {},
  formsUi: { reselectFile: 'اختر الملف مجدداً.' },
} as unknown as FormDict;

describe('resolveKey / resolveErrors', () => {
  it('walks dotted keys and returns unknown keys verbatim', () => {
    expect(resolveKey(dict, 'errors.field.required')).toBe('هذا الحقل مطلوب.');
    expect(resolveKey(dict, 'errors.nope')).toBe('errors.nope');
  });

  it('resolves a field’s keys and is undefined for a clean field', () => {
    expect(resolveErrors(dict, { name: ['errors.field.tooShort'] }, 'name')).toEqual([
      'النص أقصر من المطلوب.',
    ]);
    expect(resolveErrors(dict, { name: [] }, 'name')).toBeUndefined();
    expect(resolveErrors(dict, undefined, 'name')).toBeUndefined();
  });
});

describe('firstErrorField', () => {
  it('skips the form-level bucket and empty entries', () => {
    expect(firstErrorField(undefined)).toBeUndefined();
    expect(firstErrorField({ _form: ['x'], name: [], email: ['errors.field.email'] })).toBe('email');
  });
});

describe('<TextField>', () => {
  it('restores the submitted value, resolves the error and autofocuses the first failure', () => {
    const state: FieldState = {
      errors: { name: ['errors.field.tooShort'], email: ['errors.field.required'] },
      values: { name: 'أ', email: 'x' },
    };
    const name = renderToStaticMarkup(
      createElement(TextField, { name: 'name', label: 'الاسم', dict, required: true, state }),
    );
    expect(name).toContain('value="أ"');
    expect(name).toContain('النص أقصر من المطلوب.');
    expect(name).toContain('id="name-error"');
    expect(name).toContain('aria-invalid="true"');
    expect(name).toContain('aria-describedby="name-error"');
    expect(name).toMatch(/<input[^>]*autofocus=""/);

    // Only the first failing field gets focus.
    const email = renderToStaticMarkup(
      createElement(TextField, { name: 'email', type: 'email', label: 'البريد', dict, state }),
    );
    expect(email).not.toContain('autofocus');
    expect(email).toContain('value="x"');
    // A field that is not required says so, from the dictionary.
    expect(email).toContain('اختياري');
  });

  it('falls back to its own defaultValue when nothing was submitted', () => {
    const html = renderToStaticMarkup(
      createElement(TextField, { name: 'name', label: 'الاسم', dict, defaultValue: 'د' }),
    );
    expect(html).toContain('value="د"');
    expect(html).not.toContain('autofocus');
    expect(html).not.toContain('aria-invalid');
  });
});

describe('<TextArea> and <SelectField>', () => {
  it('restore submitted text and selection', () => {
    const state: FieldState = { values: { message: 'نص طويل', category: 'other' } };
    const area = renderToStaticMarkup(
      createElement(TextArea, { name: 'message', label: 'الرسالة', dict, state }),
    );
    expect(area).toContain('>نص طويل</textarea>');

    const select = renderToStaticMarkup(
      createElement(SelectField, {
        name: 'category',
        label: 'التصنيف',
        dict,
        state,
        options: [
          { value: 'staff_conduct', label: 'سلوك' },
          { value: 'other', label: 'أخرى' },
        ],
      }),
    );
    expect(select).toMatch(/<option value="other" selected=""/);
  });
});

describe('<CheckboxGroup>', () => {
  it('re-ticks the submitted values and renders the group error', () => {
    const html = renderToStaticMarkup(
      createElement(CheckboxGroup, {
        name: 'interest',
        legend: 'الاهتمام',
        dict,
        required: true,
        state: { errors: { interest: ['errors.field.required'] }, values: { interest: ['funding', 'other'] } },
        options: [
          { value: 'funding', label: 'تمويل' },
          { value: 'consortium', label: 'ائتلاف' },
          { value: 'other', label: 'أخرى' },
        ],
      }),
    );
    expect(html).toMatch(/value="funding"[^>]*checked=""|checked=""[^>]*value="funding"/);
    expect(html).toMatch(/value="other"[^>]*checked=""|checked=""[^>]*value="other"/);
    expect(html).not.toMatch(/value="consortium"[^>]*checked=""/);
    expect(html).toContain('id="interest-error"');
    expect(html).toContain('هذا الحقل مطلوب.');
    expect(html).toMatch(/<fieldset[^>]*aria-invalid="true"/);
  });
});

describe('<FileField>', () => {
  it('asks for the file again only after a failed submission', () => {
    const clean = renderToStaticMarkup(
      createElement(FileField, { name: 'cv', label: 'CV', dict, hint: 'PDF', accept: '.pdf' }),
    );
    expect(clean).toContain('id="cv-hint"');
    expect(clean).not.toContain('اختر الملف مجدداً.');

    const failed = renderToStaticMarkup(
      createElement(FileField, {
        name: 'cv',
        label: 'CV',
        dict,
        hint: 'PDF',
        state: { errors: { name: ['errors.field.required'] } },
      }),
    );
    expect(failed).toContain('اختر الملف مجدداً.');
    expect(failed).toMatch(/<input[^>]*type="file"[^>]*dir="ltr"/);
  });
});
