/**
 * Locale vocabulary. Zero imports — read by the proxy, by services, by cached
 * queries and by client components alike.
 */

export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * Arabic is the default, not a translation. RTL is the primary drawing and the
 * English layout is the mirror — 00-ARCHITECTURE §0.9 rule 3.
 */
export const DEFAULT_LOCALE: Locale = 'ar';

export const DIR: Record<Locale, 'rtl' | 'ltr'> = { ar: 'rtl', en: 'ltr' };

/** `lang` attribute and `Content-Language`. */
export const HTML_LANG: Record<Locale, string> = { ar: 'ar', en: 'en' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Every locale except this one, in `LOCALES` order.
 *
 * The switcher in the chrome renders one alternative because there is one;
 * with a third locale it renders a list and nothing here changes.
 */
export function otherLocales(locale: Locale): Locale[] {
  return LOCALES.filter((candidate) => candidate !== locale);
}

/**
 * The first alternative locale. Derived from `LOCALES` rather than written as
 * `locale === 'ar' ? 'en' : 'ar'`, so adding a locale does not silently make
 * this function lie about a two-way choice.
 */
export function otherLocale(locale: Locale): Locale {
  return otherLocales(locale)[0] ?? DEFAULT_LOCALE;
}

/**
 * Splits `/ar/projects/x` into its locale and the rest.
 * Returns `null` for a path that carries no locale prefix.
 */
export function splitLocalePath(pathname: string): { locale: Locale; rest: string } | null {
  const [, first, ...rest] = pathname.split('/');
  if (!isLocale(first)) return null;
  return { locale: first, rest: `/${rest.join('/')}` };
}

/** Builds `/ar/...` from a locale-less path. */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return clean === '/' ? `/${locale}` : `/${locale}${clean}`;
}

/**
 * Picks a locale from an `Accept-Language` header, falling back to the
 * default. Deliberately simple: the header is a hint for the first visit
 * only, and a cookie overrides it from then on.
 *
 * The match walks `LOCALES` rather than naming them, so a locale added to
 * that tuple is negotiated without touching this function. `ar-PS` matches
 * `ar` because a tag may carry a region; the ranking is the visitor's, and
 * the first tag that matches any locale wins.
 */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      // `split` is typed as possibly-empty, and an `Accept-Language` of `",,"`
      // really does produce empty parts. An empty tag matches no locale and
      // falls through to the default, which is the correct outcome.
      return { tag: (tag ?? '').trim().toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const match = LOCALES.find(
      (locale) => tag === locale || tag.startsWith(`${locale}-`),
    );
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

export const LOCALE_COOKIE = 'pcsrd_locale';
