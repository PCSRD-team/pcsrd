import { admin_uiAr } from '@/lib/i18n/dictionaries/partials/admin-ui';
import { type PluralForms, plural } from '@/lib/i18n/plural';

/**
 * The admin's chrome copy — `adminUi` from the `admin-ui` partial.
 *
 * Imported from the partial rather than from the root dictionary so a Client
 * Component that needs a toolbar label or a picker message does not pull the
 * whole `ar` object into the browser bundle for a handful of strings. The
 * admin is Arabic-only, so there is no locale to resolve.
 */
export const adminUi = admin_uiAr.adminUi;

/** Fills `{name}` placeholders: `fill('{n} عنصر', { n: 12 })`. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/**
 * A counted phrase with the noun agreeing with its number —
 * `count(t.fileCount, 3)` → «3 ملفات», `count(t.fileCount, 11)` → «11 ملفاً».
 * The admin is Arabic-only, so the locale is fixed.
 */
export function count(forms: PluralForms, n: number): string {
  return plural('ar', n, forms);
}
