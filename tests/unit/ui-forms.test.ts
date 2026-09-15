/* eslint-disable react/no-children-prop -- a .ts test with no JSX: `children` has to be a prop for a component whose props type requires it */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { describedBy, errorText, Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/inputs';
import { toBreadcrumbList } from '@/components/ui/breadcrumbs';
import { initialsOf } from '@/components/ui/figure';

/**
 * The field-to-control contract: three ids derived from `name`, joined for
 * `aria-describedby`, and an `aria-invalid` that cannot be set without the
 * error also being rendered. Static markup is enough — nothing here is
 * interactive, which is the point of Server-Component forms.
 */
describe('describedBy', () => {
  it('joins the ids that exist and returns undefined for none', () => {
    expect(describedBy('email')).toBeUndefined();
    expect(describedBy('email', 'hint')).toBe('email-hint');
    expect(describedBy('email', undefined, 'error')).toBe('email-error');
    expect(describedBy('email', 'hint', 'error')).toBe('email-hint email-error');
  });

  it('accepts the public forms string[] and the admin string alike', () => {
    expect(describedBy('email', undefined, ['errors.field.required'])).toBe('email-error');
    expect(describedBy('email', undefined, [])).toBeUndefined();
    expect(describedBy('email', undefined, '')).toBeUndefined();
  });
});

describe('errorText', () => {
  it('normalises both error shapes to one line', () => {
    expect(errorText(undefined)).toBeUndefined();
    expect(errorText(null)).toBeUndefined();
    expect(errorText('')).toBeUndefined();
    expect(errorText([])).toBeUndefined();
    expect(errorText('Required')).toBe('Required');
    expect(errorText(['Too short', 'Latin only'])).toBe('Too short Latin only');
  });
});

describe('<Field> + <Input>', () => {
  it('wires label, hint and error to the control by id', () => {
    const html = renderToStaticMarkup(
      createElement(Field, {
        name: 'email',
        label: 'Email',
        hint: 'We reply here',
        error: 'Enter a valid email',
        required: true,
        children: createElement(Input, {
          name: 'email',
          type: 'email',
          hint: 'We reply here',
          error: 'Enter a valid email',
        }),
      }),
    );
    expect(html).toContain('<label for="email"');
    expect(html).toContain('id="email-hint"');
    expect(html).toContain('id="email-error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="email-hint email-error"');
    // Latin-typed input is LTR and start-aligned whatever the page direction.
    expect(html).toMatch(/<input[^>]*dir="ltr"/);
    expect(html).toContain('text-start');
  });

  it('is not invalid and has no describedby when there is nothing to describe', () => {
    const html = renderToStaticMarkup(createElement(Input, { name: 'name' }));
    expect(html).not.toContain('aria-invalid');
    expect(html).not.toContain('aria-describedby');
    expect(html).not.toContain('dir=');
  });

  it('renders the optional label only when given, and never when required', () => {
    const optional = renderToStaticMarkup(
      createElement(Field, {
        name: 'a',
        label: 'A',
        optionalLabel: 'optional',
        children: createElement(Input, { name: 'a' }),
      }),
    );
    expect(optional).toContain('optional');
    const required = renderToStaticMarkup(
      createElement(Field, {
        name: 'a',
        label: 'A',
        optionalLabel: 'optional',
        required: true,
        children: createElement(Input, { name: 'a' }),
      }),
    );
    expect(required).not.toContain('>optional<');
    expect(required).toContain('*');
  });
});

describe('<Select>', () => {
  it('renders a disabled placeholder for a required single select and none for multiple', () => {
    const single = renderToStaticMarkup(
      createElement(Select, { name: 's', required: true, options: [{ value: 'a', label: 'A' }] }),
    );
    expect(single).toMatch(/<option value="" disabled=""[^>]*>—<\/option>/);
    const multiple = renderToStaticMarkup(
      createElement(Select, { name: 's', multiple: true, options: [{ value: 'a', label: 'A' }] }),
    );
    expect(multiple).not.toContain('value=""');
    expect(multiple).toContain('multiple=""');
  });
});

describe('toBreadcrumbList', () => {
  it('builds schema.org positions from the same items the nav renders', () => {
    const list = toBreadcrumbList(
      [{ label: 'Home', href: '/en' }, { label: 'News', href: '/en/news' }, { label: 'Headline' }],
      'https://example.org/',
    );
    expect(list.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.org/en' },
      { '@type': 'ListItem', position: 2, name: 'News', item: 'https://example.org/en/news' },
      { '@type': 'ListItem', position: 3, name: 'Headline' },
    ]);
  });
});

describe('initialsOf', () => {
  it('takes the first letter of up to two words, in either script', () => {
    expect(initialsOf('Amal Khalil')).toBe('AK');
    expect(initialsOf('  amal   khalil  yousef')).toBe('AK');
    expect(initialsOf('أمل خليل')).toBe('أخ');
    expect(initialsOf('')).toBe('');
  });
});
