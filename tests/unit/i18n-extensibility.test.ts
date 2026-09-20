import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  DIR,
  HTML_LANG,
  LOCALES,
  isLocale,
  localePath,
  negotiateLocale,
  otherLocale,
  otherLocales,
  splitLocalePath,
} from '@/lib/i18n/config';

/**
 * Adding a locale must be a data change.
 *
 * `LOCALES` being a tuple of two is fine — two is how many locales the site
 * publishes. What is not fine is a *function* that only works because there
 * are two, or a route that names a locale in a string. Everything below is
 * written against `LOCALES`, so these tests keep passing when the tuple grows
 * and start failing the moment something is hard-wired to `ar`/`en`.
 *
 * The one thing no test can fix is the database: content is stored as
 * `title_ar`/`title_en` column pairs and `locale_code` is a Postgres enum, so
 * a third locale is a migration, not a data change. That is recorded here so
 * the limitation is not rediscovered.
 */

const ROOT = resolve(__dirname, '../..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

describe('locale vocabulary', () => {
  it('gives every locale a direction and an html lang', () => {
    for (const locale of LOCALES) {
      expect(DIR[locale], `DIR.${locale}`).toMatch(/^(rtl|ltr)$/);
      expect(HTML_LANG[locale], `HTML_LANG.${locale}`).toBeTypeOf('string');
    }
    expect(Object.keys(DIR).sort()).toEqual([...LOCALES].sort());
    expect(Object.keys(HTML_LANG).sort()).toEqual([...LOCALES].sort());
  });

  it('keeps Arabic the default and right-to-left', () => {
    expect(DEFAULT_LOCALE).toBe('ar');
    expect(DIR[DEFAULT_LOCALE]).toBe('rtl');
  });

  it('recognises every declared locale and nothing else', () => {
    for (const locale of LOCALES) expect(isLocale(locale)).toBe(true);
    for (const value of ['fr', 'AR', '', null, undefined, 1]) {
      expect(isLocale(value), String(value)).toBe(false);
    }
  });

  it('derives the alternatives from LOCALES rather than naming them', () => {
    for (const locale of LOCALES) {
      const others = otherLocales(locale);
      expect(others).not.toContain(locale);
      expect(others).toHaveLength(LOCALES.length - 1);
      expect(otherLocale(locale)).toBe(others[0]);
    }
  });
});

describe('locale paths', () => {
  it('round-trips every locale through localePath and splitLocalePath', () => {
    for (const locale of LOCALES) {
      for (const path of ['/', '/about', '/projects/gaza-2026']) {
        const built = localePath(locale, path);
        expect(built.startsWith(`/${locale}`)).toBe(true);
        const split = splitLocalePath(built);
        expect(split?.locale).toBe(locale);
        expect(split?.rest).toBe(path);
      }
    }
  });

  it('returns null for a path with no locale prefix', () => {
    expect(splitLocalePath('/about')).toBeNull();
    expect(splitLocalePath('/fr/about')).toBeNull();
  });
});

describe('Accept-Language negotiation', () => {
  it('matches every declared locale, bare and with a region', () => {
    for (const locale of LOCALES) {
      expect(negotiateLocale(locale)).toBe(locale);
      expect(negotiateLocale(`${locale}-PS`)).toBe(locale);
      expect(negotiateLocale(`${locale.toUpperCase()};q=0.9`)).toBe(locale);
    }
  });

  it('honours the visitor’s ranking rather than the tuple order', () => {
    const [first, second] = LOCALES;
    expect(negotiateLocale(`${first};q=0.2, ${second};q=0.9`)).toBe(second);
    expect(negotiateLocale(`${second};q=0.2, ${first};q=0.9`)).toBe(first);
  });

  it('falls back to the default for anything it does not publish', () => {
    expect(negotiateLocale(null)).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale('')).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale(',,')).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale('fr-FR,de;q=0.8')).toBe(DEFAULT_LOCALE);
  });
});

describe('no locale is written into a route', () => {
  /**
   * `/ar/about` as a literal is how the 404's link list used to be built. A
   * third locale would leave those links pointing at Arabic for ever, and no
   * type would complain. `localePath(locale, '/about')` is the only spelling.
   */
  it('builds locale-prefixed hrefs with localePath', () => {
    const offenders: string[] = [];
    const literal = new RegExp(`['"\`]/(${LOCALES.join('|')})(/|['"\`])`);

    for (const file of sourceFiles(join(ROOT, 'src'))) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      // The locale config and the dictionaries are where a locale code is
      // allowed to be a literal; that is what they are for.
      if (rel.startsWith('src/lib/i18n/')) continue;
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          // Comments explain the scheme and legitimately name a path.
          if (/^\s*(\*|\/\/)/.test(line)) return;
          if (literal.test(line)) offenders.push(`${rel}:${index + 1}: ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
