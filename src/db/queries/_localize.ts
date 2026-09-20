import { sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { Locale } from '@/lib/i18n/config';

/**
 * Locale resolution.
 *
 * Queries return **resolved** objects so no component ever writes
 * `locale === 'ar' ? row.titleAr : row.titleEn`. That expression, repeated
 * across forty components, is where the English fallback silently stops
 * happening.
 *
 * `locale` is always an explicit parameter, never read from `headers()`:
 * `unstable_cache` forbids request APIs inside its scope, and a query that
 * reached for one would fail only once it was cached.
 */

/**
 * Falls back to Arabic when the English field is null or empty.
 *
 * The empty-string case matters: a form posts `''` for an untouched input, so
 * `coalesce` alone would resolve to a blank heading rather than the Arabic one.
 */
export function pickCol(ar: PgColumn, en: PgColumn, locale: Locale): SQL<string | null> {
  if (locale === 'ar') return sql<string | null>`${ar}`;
  return sql<string | null>`coalesce(nullif(${en}, ''), ${ar})`;
}

/** Same rule, applied to an already-loaded row. */
export function pick<T extends Record<string, unknown>>(
  row: T,
  base: string,
  locale: Locale,
): string | null {
  const arabic = (row[`${base}Ar`] ?? null) as string | null;
  if (locale === 'ar') return arabic;
  const english = (row[`${base}En`] ?? null) as string | null;
  return english && english.trim() !== '' ? english : arabic;
}

/**
 * True when the requested locale genuinely has content of its own.
 *
 * Drives the "this page has not been translated yet" notice. Without it an
 * English visitor sees Arabic body text with no explanation and assumes the
 * site is broken rather than incomplete.
 */
export const hasLocale = (row: { translationStatus: string }, locale: Locale): boolean =>
  locale === 'ar' || row.translationStatus !== 'ar_only';

/** The slug column for a locale — the two are separate cache entries. */
export const slugCol = (arCol: PgColumn, enCol: PgColumn, locale: Locale): PgColumn =>
  locale === 'ar' ? arCol : enCol;
