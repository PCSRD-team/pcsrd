/* eslint-disable react/no-children-prop -- a .ts test with no JSX: `children` has to be a prop for a component whose props type requires it */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Field } from '@/components/ui/field';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/inputs';
import { Grid, SectionHeading } from '@/components/ui/layout';
import { Table } from '@/components/ui/table';
import { Icon, iconNames } from '@/components/ui/icon';

/**
 * The six props consumers had to compose around.
 *
 * Each of these is a rule that cannot be checked by reading a diff: a
 * duplicate id, a field that is posted when it should not be, a column
 * header that is absent rather than hidden. Static markup is enough —
 * nothing here is interactive.
 */

// ── 1. id override, and the unposted control ─────────────────────────────

describe('control id', () => {
  it('lets an explicit id win over the one derived from name', () => {
    const html = renderToStaticMarkup(
      createElement(Input, { name: 'role', id: 'role-42', error: 'Refused' }),
    );
    expect(html).toContain('id="role-42"');
    expect(html).toContain('name="role"');
    // The whole field contract moves with the id, not with the name — this is
    // what keeps one `role` select per table row from colliding.
    expect(html).toContain('aria-describedby="role-42-error"');
    expect(html).not.toContain('id="role"');
  });

  it('keeps deriving the id from the name when no id is passed', () => {
    for (const element of [
      createElement(Input, { name: 'email' }),
      createElement(Textarea, { name: 'email' }),
      createElement(Select, { name: 'email', options: [{ value: 'a', label: 'A' }] }),
    ]) {
      expect(renderToStaticMarkup(element)).toContain('id="email"');
    }
  });

  it('posts nothing when a control has an id and no name', () => {
    for (const element of [
      createElement(Input, { id: 'picker-search', type: 'search' }),
      createElement(Textarea, { id: 'row-body-0' }),
      createElement(Select, { id: 'row-platform-0', options: [{ value: 'a', label: 'A' }] }),
    ]) {
      const html = renderToStaticMarkup(element);
      expect(html).not.toContain('name=');
      expect(html).toMatch(/id="(picker-search|row-body-0|row-platform-0)"/);
    }
  });

  it('still describes an unposted control by its own id', () => {
    const html = renderToStaticMarkup(
      createElement(Field, {
        name: 'channel-url-0',
        label: 'URL',
        hint: 'Full address',
        children: createElement(Input, { id: 'channel-url-0', hint: 'Full address' }),
      }),
    );
    expect(html).toContain('<label for="channel-url-0"');
    expect(html).toContain('id="channel-url-0-hint"');
    expect(html).toContain('aria-describedby="channel-url-0-hint"');
    expect(html).not.toContain('name=');
  });

  it('renders a self-labelling checkbox with neither id nor name', () => {
    const html = renderToStaticMarkup(createElement(Checkbox, { label: 'Visible' }));
    expect(html).not.toContain('name=');
    expect(html).not.toContain('id=');
    expect(html).not.toContain('aria-describedby');
    expect(html).toContain('Visible');
  });

  it('does not hand a controlled select a defaultValue as well', () => {
    // React refuses `value` and `defaultValue` together; the placeholder
    // fallback is for uncontrolled selects only.
    const html = renderToStaticMarkup(
      createElement(Select, {
        id: 'platform-0',
        value: 'x',
        onChange: () => {},
        placeholder: null,
        options: [{ value: 'x', label: 'X' }],
      }),
    );
    expect(html).toContain('<option value="x" selected="">X</option>');
    expect(html).not.toContain('value=""');
  });
});

// ── 2. the dialog surface is exercised via its own module ────────────────
// (see `src/components/ui/dialog.tsx` — it takes a required `title`/`titleId`,
//  which is the property a hand-rolled wrapper forgets.)

// ── 3. icon glyphs ───────────────────────────────────────────────────────

describe('Icon', () => {
  it('carries the editor and navigation glyphs the consumers kept locally', () => {
    for (const name of [
      'bold',
      'italic',
      'h2',
      'h3',
      'bulletList',
      'orderedList',
      'blockquote',
      'link',
      'unlink',
      'home',
      'content',
      'project',
      'news',
      'story',
      'job',
      'page',
      'metric',
      'partner',
      'people',
      'publication',
      'media',
      'inbox',
      'shield',
      'organization',
      'redirect',
      'users',
      'audit',
    ]) {
      expect(iconNames).toContain(name);
    }
  });

  it('renders every glyph on the same 24 grid at the same weight, and hides it', () => {
    for (const name of iconNames) {
      const html = renderToStaticMarkup(createElement(Icon, { name }));
      expect(html).toContain('viewBox="0 0 24 24"');
      expect(html).toContain('stroke-width="1.75"');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toMatch(/<path d="[^"]+"/);
    }
  });

  it('draws a multi-stroke glyph as several paths, not one', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'bold' }));
    expect(html.match(/<path /g)).toHaveLength(2);
  });
});

// ── 4. Table row actions ─────────────────────────────────────────────────

describe('<Table actions>', () => {
  const rows = [{ id: '1', title: 'A record' }];
  const columns = [{ key: 'title', header: 'Title', cell: (row: (typeof rows)[number]) => row.title }];

  it('adds a final column whose header is present but visually hidden', () => {
    const html = renderToStaticMarkup(
      createElement(Table<(typeof rows)[number]>, {
        caption: 'Records',
        rows,
        columns,
        empty: 'None',
        actionsLabel: 'الإجراءات',
        actions: (row) => `edit ${row.id}`,
      }),
    );
    // Present for a screen reader…
    expect(html).toContain('<span class="sr-only">الإجراءات</span>');
    // …inside a real column header, not a bare cell.
    expect(html).toMatch(/<th scope="col"[^>]*><span class="sr-only">الإجراءات<\/span><\/th>/);
    expect(html).toContain('edit 1');
    // Two headers, two cells: the actions column is counted on both rows.
    expect(html.match(/<th /g)).toHaveLength(2);
  });

  it('renders no extra column when there are no actions', () => {
    const html = renderToStaticMarkup(
      createElement(Table<(typeof rows)[number]>, {
        caption: 'Records',
        rows,
        columns,
        empty: 'None',
      }),
    );
    expect(html).not.toContain('sr-only');
    expect(html.match(/<th /g)).toHaveLength(1);
  });
});

// ── 5. SectionHeading size vs element ────────────────────────────────────

describe('<SectionHeading>', () => {
  it('defaults the visual size to the element, as it always did', () => {
    expect(renderToStaticMarkup(createElement(SectionHeading, { title: 'T' }))).toContain(
      '<h2 class="font-semibold text-ink text-h2"',
    );
    expect(
      renderToStaticMarkup(createElement(SectionHeading, { title: 'T', as: 'h3' })),
    ).toContain('text-h3');
  });

  it('lets the size be chosen independently of the outline level', () => {
    const html = renderToStaticMarkup(
      createElement(SectionHeading, { title: 'T', as: 'h3', size: 'h2' }),
    );
    expect(html).toContain('<h3 ');
    expect(html).toContain('text-h2');
    expect(html).not.toContain('text-h3');
  });
});

// ── 6. Grid labelling ────────────────────────────────────────────────────

describe('<Grid>', () => {
  it('restates the list role that display:grid removes, and takes a name', () => {
    const html = renderToStaticMarkup(
      createElement(Grid, { as: 'ul', labelledBy: 'programmes-heading', children: 'x' }),
    );
    expect(html).toContain('role="list"');
    expect(html).toContain('aria-labelledby="programmes-heading"');
  });

  it('claims no role for a plain div, and lets one be chosen', () => {
    expect(renderToStaticMarkup(createElement(Grid, { children: 'x' }))).not.toContain('role=');
    expect(
      renderToStaticMarkup(createElement(Grid, { as: 'ul', role: 'none', children: 'x' })),
    ).toContain('role="none"');
    expect(
      renderToStaticMarkup(createElement(Grid, { label: 'Figures', role: 'group', children: 'x' })),
    ).toContain('aria-label="Figures"');
  });
});
