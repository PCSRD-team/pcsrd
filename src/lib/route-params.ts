/**
 * A dynamic route segment, as text.
 *
 * Next hands a page its `params` still percent-encoded when the segment is not
 * ASCII — `%D8%A7%D9%84...` rather than `التعافي-المبكر` — at least on the
 * prerender and the first server render. Every slug on this site is Arabic in
 * the default locale, so the database lookup matched nothing, the page called
 * `notFound()` after its shell had streamed, and the served HTML was the
 * loading skeleton: no heading, no text, for any crawler or reader without
 * JavaScript. The browser then re-rendered from the RSC payload with the
 * decoded value, which is why nothing looked broken on screen.
 *
 * Decoding is idempotent for every slug the site can produce: `slugify` never
 * emits `%`, so a value that is already decoded passes through unchanged. A
 * malformed escape is returned as given and simply matches nothing.
 */
export function decodeParam(value: string): string {
  if (!value.includes('%')) return value.normalize('NFC');
  try {
    return decodeURIComponent(value).normalize('NFC');
  } catch {
    return value;
  }
}
