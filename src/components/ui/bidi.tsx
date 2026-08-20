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
 * Both are needed: `dir` alone does not isolate, and `<bdi>` alone infers
 * direction from the first strong character, which a leading digit is not.
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

/** A reference code, ID or licence number: isolated and set in mono. */
export function Code({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={`font-mono ${className ?? ''}`}>
      {children}
    </bdi>
  );
}
