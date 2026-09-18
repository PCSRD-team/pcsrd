'use client';
// Client Component: the character counters and "copy from Arabic" need the
// live value (`useState`); the ids are `useId` so two fields on one page
// never collide. The inputs still post natively.

import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError, FieldRow, Fieldset } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/inputs';
import { Eyebrow } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import { adminUi } from './admin-ui-dict';

/**
 * The defining component of the authoring experience.
 *
 * Five properties, all load-bearing:
 *
 * 1. **Both locales visible at once** — side by side on desktop, stacked on
 *    mobile. An editor comparing a translation against its source should not
 *    have to hold one of them in their head.
 * 2. **`dir` per field, not per page.** The Arabic input is RTL and the English
 *    input is LTR *on the same row*. Inheriting the page direction is what
 *    makes an English draft render right-aligned with its punctuation at the
 *    wrong end while it is being typed.
 * 3. **Arabic required, English optional**, and the asterisk says so.
 * 4. **Copy from Arabic** for the fields that are genuinely identical across
 *    locales — proper nouns, numbers, licence references. Without it an editor
 *    retypes them and introduces a discrepancy.
 * 5. **A character count against the SEO limit**, because Arabic runs about ten
 *    percent longer per character and a title that fits in English will not.
 *
 * The controls are the kit's `Input`/`Textarea` with an explicit `id`: the
 * ids come from `useId` so the same field can appear twice on a page (the
 * SEO title and the title, say) without a collision, while `name` stays the
 * posted `…Ar` / `…En` pair. The kit derives everything else — the
 * `describedBy`/`aria-invalid` contract — from that id.
 */

function Meta({
  id,
  length,
  max,
  error,
}: {
  id: string;
  length: number;
  max?: number;
  error?: string;
}) {
  if (!max && !error) return null;
  const over = max !== undefined && length > max;

  return (
    <div className="mbs-1 flex items-baseline justify-between gap-3">
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : <span />}
      {max ? (
        <span
          dir="ltr"
          className={cn('font-mono text-eyebrow', over ? 'text-destructive' : 'text-mono-muted')}
        >
          {length}/{max}
        </span>
      ) : null}
    </div>
  );
}

export function BilingualField({
  name,
  label,
  required,
  multiline,
  maxLength,
  defaultAr = '',
  defaultEn = '',
  errorAr,
  errorEn,
  hint,
}: {
  /** `title` becomes the inputs `titleAr` and `titleEn`. */
  name: string;
  label: string;
  required?: boolean;
  multiline?: boolean;
  maxLength?: { ar?: number; en?: number };
  defaultAr?: string;
  defaultEn?: string;
  errorAr?: string;
  errorEn?: string;
  hint?: string;
}) {
  const [ar, setAr] = useState(defaultAr);
  const [en, setEn] = useState(defaultEn);
  const id = useId();
  const t = adminUi.bilingual;

  /**
   * One control per locale, chosen by `multiline` — the kit's `Textarea`
   * already carries `resize-y`, so only the shorter minimum height is
   * restated here.
   */
  const control = (locale: 'ar' | 'en') => {
    const props = {
      id: `${id}-${locale}`,
      name: locale === 'ar' ? `${name}Ar` : `${name}En`,
      dir: locale === 'ar' ? ('rtl' as const) : ('ltr' as const),
      lang: locale,
      required: locale === 'ar' ? required : undefined,
      value: locale === 'ar' ? ar : en,
      error: locale === 'ar' ? errorAr : errorEn,
      className: cn('mbs-1', locale === 'en' && 'text-start'),
    };
    const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      (locale === 'ar' ? setAr : setEn)(e.target.value);

    return multiline ? (
      <Textarea {...props} rows={4} className={cn(props.className, 'min-h-24')} onChange={onChange} />
    ) : (
      <Input {...props} onChange={onChange} />
    );
  };

  return (
    <Fieldset name={id} legend={label} hint={hint} required={required}>
      <FieldRow>
        <div>
          <Eyebrow as="span" className="block">
            <label htmlFor={`${id}-ar`}>{t.arabic}</label>
          </Eyebrow>
          {control('ar')}
          <Meta id={`${id}-ar`} length={ar.length} max={maxLength?.ar} error={errorAr} />
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Eyebrow as="span">
              <label htmlFor={`${id}-en`}>{t.english}</label>
            </Eyebrow>
            <Button type="button" tone="quiet" size="sm" onClick={() => setEn(ar)}>
              {t.copyFromArabic}
            </Button>
          </div>
          {control('en')}
          <Meta id={`${id}-en`} length={en.length} max={maxLength?.en} error={errorEn} />
        </div>
      </FieldRow>
    </Fieldset>
  );
}

/**
 * Derives `translation_status` from what is actually filled in, rather than
 * asking the editor to maintain a field that describes their own work.
 *
 * The `partial` case is surfaced as a warning rather than stored: the column
 * has no such value, and a half-translated page is a state to fix, not a state
 * to record.
 */
export function translationStatusFrom(
  pairs: { ar: string | null; en: string | null }[],
): { status: 'ar_only' | 'human_translated'; partial: boolean } {
  const translatable = pairs.filter((pair) => pair.ar?.trim());
  if (translatable.length === 0) return { status: 'ar_only', partial: false };

  const filled = translatable.filter((pair) => pair.en?.trim()).length;
  if (filled === 0) return { status: 'ar_only', partial: false };
  if (filled === translatable.length) return { status: 'human_translated', partial: false };
  return { status: 'ar_only', partial: true };
}
