import type { ReactNode } from 'react';

/**
 * Isolates a Latin or numeric run inside Arabic text.
 *
 * Without this, the Unicode bidirectional algorithm reorders neighbouring
 * punctuation across the boundary: a phone number renders with its country code
 * at the wrong end, a licence number `RA-2847-C` becomes `C-2847-RA`, and a URL
 * ending in a full stop moves the stop to the front. The text is not corrupted
 * — it is displayed wrongly, which is worse, because it looks deliberate.
 *
 * `<bdi>` opens an isolation run; `dir="ltr"` sets the direction inside it.
 * `<bdi>` alone would infer direction from the first strong character, which a
 * leading digit is not, so the explicit `dir` is what makes it deterministic.
 * (`dir` on its own would in fact isolate — the UA stylesheet applies
 * `unicode-bidi: isolate` to `[dir]` — but `<bdi>` states the intent.)
 *
 * Use for: phone numbers, emails, URLs, licence numbers, reference codes,
 * IDs, file sizes, version strings — anything Latin appearing in Arabic prose.
 */
export function Bidi({
  children,
  dir = 'ltr',
  className,
}: {
  children: ReactNode;
  dir?: 'ltr' | 'rtl';
  className?: string;
}) {
  return (
    <bdi dir={dir} className={className}>
      {children}
    </bdi>
  );
}

/**
 * A formatted date or period.
 *
 * Not a `<Bidi>`. `formatDate('ar', ...)` returns `15 يناير 2026` — Arabic month
 * names with Latin digits, so the string's *dominant* direction is RTL even
 * though it contains numerals. Wrapping it in an LTR isolate, which every call
 * site used to do, made the paragraph direction LTR inside the isolate and put
 * the **start** of a range leftmost: `يناير 2024 – ديسمبر 2026` read with the
 * start date where an Arabic reader scanning right-to-left arrives last.
 *
 * The digits need no isolation of their own — `format.ts` pins `-nu-latn` and
 * `globals.css` sets `font-variant-numeric: lining-nums` on `:lang(ar)`.
 */
export function DateText({
  children,
  locale,
  className,
}: {
  children: ReactNode;
  locale: 'ar' | 'en';
  className?: string;
}) {
  return (
    <bdi dir={locale === 'ar' ? 'rtl' : 'ltr'} className={className}>
      {children}
    </bdi>
  );
}

/** A reference code, ID or licence number: isolated and set in mono. */
export function Code({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={`font-mono ${className ?? ''}`}>
      {children}
    </bdi>
  );
}
