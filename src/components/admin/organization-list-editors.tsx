'use client';

import { useMemo, useState } from 'react';
import { Field, inputClass } from '@/components/admin/controls';

export type TitledBlock = {
  title_ar: string;
  title_en?: string | null;
  body_ar?: string | null;
  body_en?: string | null;
};

export type BilingualLine = { text_ar: string; text_en?: string | null };

const buttonClass =
  'min-h-10 rounded-md border border-rule px-3 text-caption font-medium text-ink hover:bg-paper-alt';

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
  const payload = useMemo(
    () => JSON.stringify(items.map((item) => item.trim()).filter(Boolean)),
    [items],
  );

  return (
    <section className="space-y-3 rounded-lg border border-rule bg-white/60 p-4">
      <input type="hidden" name={name} value={payload} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-small font-semibold text-ink">{label}</h3>
        <button type="button" className={buttonClass} onClick={() => setItems((rows) => [...rows, ''])}>
          + إضافة عنصر
        </button>
      </div>
      {error ? <p className="text-caption text-gold-700">{error}</p> : null}
      {items.length === 0 ? <p className="text-caption text-ink-55">لا توجد عناصر بعد.</p> : null}
      {items.map((item, index) => (
        <div key={index} className="flex items-end gap-3">
          <Field name={`${name}-${index}`} label={`العنصر ${index + 1}`}>
            <input
              id={`${name}-${index}`}
              value={item}
              placeholder={placeholder}
              dir={dir}
              onChange={(event) =>
                setItems((rows) => rows.map((row, rowIndex) => (rowIndex === index ? event.currentTarget.value : row)))
              }
              className={dir === 'ltr' ? `${inputClass} text-start` : inputClass}
            />
          </Field>
          <button
            type="button"
            className={buttonClass}
            onClick={() => setItems((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
          >
            حذف
          </button>
        </div>
      ))}
    </section>
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
    <section className="space-y-4 rounded-lg border border-rule bg-white/60 p-4">
      <input type="hidden" name={name} value={payload} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-small font-semibold text-ink">{label}</h3>
        <button
          type="button"
          className={buttonClass}
          onClick={() => setItems((rows) => [...rows, { title_ar: '', title_en: '', body_ar: '', body_en: '' }])}
        >
          + إضافة عنصر
        </button>
      </div>
      {error ? <p className="text-caption text-gold-700">{error}</p> : null}
      {items.length === 0 ? <p className="text-caption text-ink-55">لا توجد عناصر بعد.</p> : null}
      {items.map((item, index) => (
        <div key={index} className="space-y-3 rounded-md border border-rule bg-paper p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-caption font-semibold text-ink">العنصر {index + 1}</p>
            <button type="button" className={buttonClass} onClick={() => setItems((rows) => rows.filter((_, i) => i !== index))}>
              حذف
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field name={`${name}-title-ar-${index}`} label="العنوان (عربي)" required>
              <input id={`${name}-title-ar-${index}`} value={item.title_ar} onChange={(e) => update(index, { title_ar: e.currentTarget.value })} className={inputClass} />
            </Field>
            <Field name={`${name}-title-en-${index}`} label="Title (English)">
              <input id={`${name}-title-en-${index}`} value={item.title_en ?? ''} onChange={(e) => update(index, { title_en: e.currentTarget.value })} dir="ltr" className={`${inputClass} text-start`} />
            </Field>
            <Field name={`${name}-body-ar-${index}`} label="الوصف (عربي)">
              <textarea id={`${name}-body-ar-${index}`} rows={3} value={item.body_ar ?? ''} onChange={(e) => update(index, { body_ar: e.currentTarget.value })} className={inputClass} />
            </Field>
            <Field name={`${name}-body-en-${index}`} label="Description (English)">
              <textarea id={`${name}-body-en-${index}`} rows={3} value={item.body_en ?? ''} onChange={(e) => update(index, { body_en: e.currentTarget.value })} dir="ltr" className={`${inputClass} text-start`} />
            </Field>
          </div>
        </div>
      ))}
    </section>
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
  const payload = useMemo(
    () => JSON.stringify(items.map((item) => ({ text_ar: item.text_ar.trim(), text_en: item.text_en?.trim() || null })).filter((item) => item.text_ar || item.text_en)),
    [items],
  );
  const update = (index: number, patch: Partial<BilingualLine>) =>
    setItems((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));

  return (
    <section className="space-y-4 rounded-lg border border-rule bg-white/60 p-4">
      <input type="hidden" name={name} value={payload} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-small font-semibold text-ink">{label}</h3>
        <button type="button" className={buttonClass} onClick={() => setItems((rows) => [...rows, { text_ar: '', text_en: '' }])}>
          + إضافة عنصر
        </button>
      </div>
      {error ? <p className="text-caption text-gold-700">{error}</p> : null}
      {items.length === 0 ? <p className="text-caption text-ink-55">لا توجد عناصر بعد.</p> : null}
      {items.map((item, index) => (
        <div key={index} className="grid items-end gap-3 rounded-md border border-rule bg-paper p-4 md:grid-cols-[1fr_1fr_auto]">
          <Field name={`${name}-ar-${index}`} label="النص (عربي)" required>
            <textarea id={`${name}-ar-${index}`} rows={2} value={item.text_ar} onChange={(e) => update(index, { text_ar: e.currentTarget.value })} className={inputClass} />
          </Field>
          <Field name={`${name}-en-${index}`} label="Text (English)">
            <textarea id={`${name}-en-${index}`} rows={2} value={item.text_en ?? ''} onChange={(e) => update(index, { text_en: e.currentTarget.value })} dir="ltr" className={`${inputClass} text-start`} />
          </Field>
          <button type="button" className={buttonClass} onClick={() => setItems((rows) => rows.filter((_, i) => i !== index))}>
            حذف
          </button>
        </div>
      ))}
    </section>
  );
}
