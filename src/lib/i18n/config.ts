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

export const LOCALE_LABEL: Record<Locale, string> = { ar: 'العربية', en: 'English' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** The other locale — the language switcher never needs more than this. */
export function otherLocale(locale: Locale): Locale {
  return locale === 'ar' ? 'en' : 'ar';
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
 * Picks a locale from an `Accept-Language` header, falling back to Arabic.
 * Deliberately simple: the header is a hint for the first visit only, and a
 * cookie overrides it from then on.
 */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    if (tag.startsWith('ar')) return 'ar';
    if (tag.startsWith('en')) return 'en';
  }
  return DEFAULT_LOCALE;
}

export const LOCALE_COOKIE = 'pcsrd_locale';
