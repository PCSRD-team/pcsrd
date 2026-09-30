import { COUNTRY_CODES } from '@/lib/validation/country-codes';

export type CountryOption = { value: string; label: string };

/**
 * The country list for a `<select>`, named and ordered in the locale.
 *
 * The names come from `Intl.DisplayNames` (CLDR), so there is no country copy
 * in the dictionaries to translate. The value posted is still the ISO code the
 * schema validates.
 *
 * Call it on the server and pass the result down where you can: the browser's
 * CLDR data may name or order a handful of countries differently from Node's,
 * and a list built on both sides of hydration can then disagree.
 */
export function countryOptions(locale: string): CountryOption[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    names = null;
  }
  const collator = new Intl.Collator(locale);
  return COUNTRY_CODES.map((code) => ({ value: code, label: names?.of(code) ?? code })).sort(
    (a, b) => collator.compare(a.label, b.label),
  );
}
