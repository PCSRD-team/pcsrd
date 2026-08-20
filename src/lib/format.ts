import type { Locale } from './i18n/config';

/**
 * Formatting that must not differ between two components rendering the same
 * value. Dates in particular: `toLocaleDateString` with no explicit options
 * gives a different string on a server in Tokyo than in a browser in Gaza.
 */

/**
 * Gregorian, Western Arabic numerals in both locales, explicit UTC.
 *
 * `ar` alone would select the Islamic calendar on some platforms and Eastern
 * Arabic digits on others; `ar-u-ca-gregory-nu-latn` pins both, which is what
 * the spec requires so a date on the site matches a date on a document.
 */
const DATE_LOCALE: Record<Locale, string> = {
  ar: 'ar-u-ca-gregory-nu-latn',
  en: 'en-GB',
};

export function formatDate(
  value: Date | string | null | undefined,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' },
): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], { ...options, timeZone: 'UTC' }).format(date);
}

/** `2024 — 2026`, or `منذ 2024` when the end is open. */
export function formatPeriod(
  start: string | null,
  end: string | null,
  locale: Locale,
): string {
  const from = formatDate(start, locale, { year: 'numeric', month: 'short' });
  const to = formatDate(end, locale, { year: 'numeric', month: 'short' });
  if (from && to) return `${from} – ${to}`;
  return from || to || '';
}

export function formatNumber(value: number | string, locale: Locale): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return String(value);
  // Trailing `.00` on a beneficiary count is noise; a genuine fraction is kept.
  const fractionDigits = Number.isInteger(n) ? 0 : 2;
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

export function formatFileSize(bytes: number | null | undefined, locale: Locale): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${formatNumber(Math.round(mb * 10) / 10, locale)} MB`;
  return `${formatNumber(Math.round(bytes / 1024), locale)} KB`;
}

/** Public URL for a Storage object. */
export function storageUrl(supabaseUrl: string, bucket: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}
