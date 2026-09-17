'use client';
// Client Component: each editor keeps a list in state and serialises it into
// one hidden JSON input; adding and removing rows is what needs the script.

import { useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { Field, FieldError, FieldRow } from '@/components/ui/field';
import { Stack } from '@/components/ui/layout';
import { Caption, Heading } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import { adminUi, fill } from './admin-ui-dict';

export type TitledBlock = {
  title_ar: string;
  title_en?: string | null;
  body_ar?: string | null;
  body_en?: string | null;
};

export type BilingualLine = { text_ar: string; text_en?: string | null };

/**
 * The row controls are native elements wearing the kit's `control` utility,
 * not the kit's `Input`/`Textarea`. Those carry a `name` and would be posted
 * with the form; these rows are *not* posted — the hidden JSON input is — so
 * they must stay nameless. The `Field` around each still supplies the label
 * and the id contract.
 */
const control = 'control';
const controlLtr = 'control text-start';

/** The heading row of an editor: its name and the add button. */
function EditorHeader({
  id,
  label,
  onAdd,
}: {
  id: string;
  label: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Heading level={3} size="h4" id={id}>
        {label}
      </Heading>
      <Button type="button" tone="secondary" size="sm" onClick={onAdd}>
        {adminUi.organization.lists.addItem}
      </Button>
    </div>
  );
}

export function StringListEditor({
  name,
  label,
  initialItems,
  placeholder,
  error,
  dir,
}: {
  name: string;
  label: string;
  initialItems: string[];
  placeholder: string;
  error?: string;
  dir?: 'ltr' | 'rtl';
}) {
  const [items, setItems] = useState(initialItems);
  const headingId = useId();
  const t = adminUi.organization.lists;
  const payload = useMemo(
    () => JSON.stringify(items.map((item) => item.trim()).filter(Boolean)),
    [items],
  );

  return (
    <Panel as="section" padding="sm" labelledBy={headingId}>
      <Stack gap={3}>
        <input type="hidden" name={name} value={payload} />
        <EditorHeader id={headingId} label={label} onAdd={() => setItems((rows) => [...rows, ''])} />
        {error ? <FieldError id={`${name}-error`}>{error}</FieldError> : null}
        {items.length === 0 ? <Caption>{t.empty}</Caption> : null}
        {items.map((item, index) => (
          <div key={index} className="flex items-end gap-3">
            <Field name={`${name}-${index}`} label={fill(t.item, { n: index + 1 })} className="flex-1">
              <input
                id={`${name}-${index}`}
                value={item}
                placeholder={placeholder}
                dir={dir}
                onChange={(event) =>
                  setItems((rows) =>
                    rows.map((row, rowIndex) => (rowIndex === index ? event.currentTarget.value : row)),
                  )
                }
                className={dir === 'ltr' ? controlLtr : control}
              />
            </Field>
            <Button
              type="button"
              tone="quiet"
              size="sm"
              onClick={() => setItems((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
            >
              {t.remove}
            </Button>
          </div>
        ))}
      </Stack>
    </Panel>
  );
}

export function TitledBlocksEditor({
  name,
  label,
  initialItems,
  error,
}: {
  name: string;
  label: string;
  initialItems: TitledBlock[];
  error?: string;
}) {
  const [items, setItems] = useState(initialItems);
  const headingId = useId();
  const t = adminUi.organization.lists;
  const payload = useMemo(
    () =>
      JSON.stringify(
        items
          .map((item) => ({
            title_ar: item.title_ar.trim(),
            title_en: item.title_en?.trim() || null,
            body_ar: item.body_ar?.trim() || null,
            body_en: item.body_en?.trim() || null,
          }))
          .filter((item) => item.title_ar || item.title_en || item.body_ar || item.body_en),
      ),
    [items],
  );
  const update = (index: number, patch: Partial<TitledBlock>) =>
    setItems((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));

  return (
    <Panel as="section" padding="sm" labelledBy={headingId}>
      <Stack gap={4}>
        <input type="hidden" name={name} value={payload} />
        <EditorHeader
          id={headingId}
          label={label}
          onAdd={() =>
            setItems((rows) => [...rows, { title_ar: '', title_en: '', body_ar: '', body_en: '' }])
          }
        />
        {error ? <FieldError id={`${name}-error`}>{error}</FieldError> : null}
        {items.length === 0 ? <Caption>{t.empty}</Caption> : null}
        {items.map((item, index) => (
          <Panel key={index} tone="alt" padding="sm">
            <Stack gap={3}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-caption font-semibold text-ink">{fill(t.item, { n: index + 1 })}</p>
                <Button
                  type="button"
                  tone="quiet"
                  size="sm"
                  onClick={() => setItems((rows) => rows.filter((_, i) => i !== index))}
                >
                  {t.remove}
                </Button>
              </div>
              <FieldRow>
                <Field name={`${name}-title-ar-${index}`} label={t.titleAr} required>
                  <input
                    id={`${name}-title-ar-${index}`}
                    value={item.title_ar}
                    onChange={(e) => update(index, { title_ar: e.currentTarget.value })}
                    className={control}
                  />
                </Field>
                <Field name={`${name}-title-en-${index}`} label={t.titleEn}>
                  <input
                    id={`${name}-title-en-${index}`}
                    value={item.title_en ?? ''}
                    onChange={(e) => update(index, { title_en: e.currentTarget.value })}
                    dir="ltr"
                    className={controlLtr}
                  />
                </Field>
                <Field name={`${name}-body-ar-${index}`} label={t.bodyAr}>
                  <textarea
                    id={`${name}-body-ar-${index}`}
                    rows={3}
                    value={item.body_ar ?? ''}
                    onChange={(e) => update(index, { body_ar: e.currentTarget.value })}
                    className={cn(control, 'resize-y')}
                  />
                </Field>
                <Field name={`${name}-body-en-${index}`} label={t.bodyEn}>
                  <textarea
                    id={`${name}-body-en-${index}`}
                    rows={3}
                    value={item.body_en ?? ''}
                    onChange={(e) => update(index, { body_en: e.currentTarget.value })}
                    dir="ltr"
                    className={cn(controlLtr, 'resize-y')}
                  />
                </Field>
              </FieldRow>
            </Stack>
          </Panel>
        ))}
      </Stack>
    </Panel>
  );
}

export function BilingualLinesEditor({
  name,
  label,
  initialItems,
  error,
}: {
  name: string;
  label: string;
  initialItems: BilingualLine[];
  error?: string;
}) {
  const [items, setItems] = useState(initialItems);
  const headingId = useId();
  const t = adminUi.organization.lists;
  const payload = useMemo(
    () =>
      JSON.stringify(
        items
          .map((item) => ({ text_ar: item.text_ar.trim(), text_en: item.text_en?.trim() || null }))
          .filter((item) => item.text_ar || item.text_en),
      ),
    [items],
  );
  const update = (index: number, patch: Partial<BilingualLine>) =>
    setItems((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));

  return (
    <Panel as="section" padding="sm" labelledBy={headingId}>
      <Stack gap={4}>
        <input type="hidden" name={name} value={payload} />
        <EditorHeader
          id={headingId}
          label={label}
          onAdd={() => setItems((rows) => [...rows, { text_ar: '', text_en: '' }])}
        />
        {error ? <FieldError id={`${name}-error`}>{error}</FieldError> : null}
        {items.length === 0 ? <Caption>{t.empty}</Caption> : null}
        {items.map((item, index) => (
          <Panel key={index} tone="alt" padding="sm">
            <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
              <Field name={`${name}-ar-${index}`} label={t.textAr} required>
                <textarea
                  id={`${name}-ar-${index}`}
                  rows={2}
                  value={item.text_ar}
                  onChange={(e) => update(index, { text_ar: e.currentTarget.value })}
                  className={cn(control, 'resize-y')}
                />
              </Field>
              <Field name={`${name}-en-${index}`} label={t.textEn}>
                <textarea
                  id={`${name}-en-${index}`}
                  rows={2}
                  value={item.text_en ?? ''}
                  onChange={(e) => update(index, { text_en: e.currentTarget.value })}
                  dir="ltr"
                  className={cn(controlLtr, 'resize-y')}
                />
              </Field>
              <Button
                type="button"
                tone="quiet"
                size="sm"
                onClick={() => setItems((rows) => rows.filter((_, i) => i !== index))}
              >
                {t.remove}
              </Button>
            </div>
          </Panel>
        ))}
      </Stack>
    </Panel>
  );
}
