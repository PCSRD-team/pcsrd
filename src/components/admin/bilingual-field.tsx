'use client';

import { useId, useState } from 'react';

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
 */

const controlClass =
  'block w-full rounded-md rule-control bg-paper px-3 py-2 text-small text-ink focus:border-navy-700';

function Meta({
  length,
  max,
  error,
}: {
  length: number;
  max?: number;
  error?: string;
}) {
  if (!max && !error) return null;
  const over = max !== undefined && length > max;

  return (
    <div className="mbs-1 flex items-baseline justify-between gap-3">
      {error ? (
        <p className="text-caption text-gold-700" role="alert">
          {error}
        </p>
      ) : (
        <span />
      )}
      {max ? (
        <span
          dir="ltr"
          className={`font-mono text-eyebrow ${over ? 'text-gold-700' : 'text-mono-muted'}`}
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

  const Control = multiline ? 'textarea' : 'input';
  const shared = { rows: multiline ? 4 : undefined } as { rows?: number };

  return (
    <fieldset className="rounded-lg border border-rule bg-paper p-4 shadow-[0_10px_28px_rgb(20_33_63/0.04)]">
      <legend className="px-2 text-small font-medium text-ink">
        {label}
        {required ? (
          <span className="ms-1 text-gold-700" aria-hidden="true">
            *
          </span>
        ) : null}
        {hint ? <span className="ms-3 text-caption text-ink-55">{hint}</span> : null}
      </legend>

      <div className="grid gap-4 md:grid-cols-2">
      <div>
        <label htmlFor={`${id}-ar`} className="eyebrow">
          العربية
        </label>
        <Control
          {...shared}
          id={`${id}-ar`}
          name={`${name}Ar`}
          dir="rtl"
          lang="ar"
          required={required}
          value={ar}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setAr(e.target.value)
          }
          className={`${controlClass} mbs-1`}
        />
        <Meta length={ar.length} max={maxLength?.ar} error={errorAr} />
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={`${id}-en`} className="eyebrow">
            English
          </label>
          <button
            type="button"
            onClick={() => setEn(ar)}
            className="text-caption text-navy-700 underline"
          >
            نسخ من العربية
          </button>
        </div>
        <Control
          {...shared}
          id={`${id}-en`}
          name={`${name}En`}
          dir="ltr"
          lang="en"
          value={en}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setEn(e.target.value)
          }
          className={`${controlClass} mbs-1 text-start`}
        />
        <Meta length={en.length} max={maxLength?.en} error={errorEn} />
      </div>
      </div>
    </fieldset>
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
