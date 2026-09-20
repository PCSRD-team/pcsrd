import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ar } from '@/lib/i18n/dictionaries/ar';
import { en } from '@/lib/i18n/dictionaries/en';
import { LOCALES } from '@/lib/i18n/config';

/**
 * The dictionaries, checked the way the compiler cannot.
 *
 * TypeScript already guarantees the *shape*: `Dictionary` is `typeof ar`, so
 * `en.ts` fails to compile when a key is missing. It guarantees nothing about
 * the things that actually shipped a bug:
 *
 * 1. A key present in `en` and **not** in `ar`. `en: Dictionary` is an
 *    assignability check, and an object with an extra property is still
 *    assignable through a variable. Only a value-level walk catches it.
 * 2. An empty or placeholder string. A blank heading typechecks perfectly.
 * 3. A `{n}`-style placeholder that one locale interpolates and the other
 *    drops, so `fill()` leaves a literal `{n}` on screen in one language.
 * 4. **A key that code throws and no dictionary defines.** `resolveKey` in
 *    `components/forms/fields.tsx` and `resolveAdminKey` in
 *    `components/admin/admin-dict.ts` both return the key verbatim when it
 *    does not resolve, which once put the Latin string
 *    `errors.media.minorConsentState` inside a right-to-left Arabic screen.
 *    That is the failure this file exists for, and it is checked against the
 *    source rather than against a list kept by hand.
 */

const ROOT = resolve(__dirname, '../..');
const SRC = join(ROOT, 'src');

type Node = Record<string, unknown>;

/**
 * Every leaf in an object, as its segments.
 *
 * Segments, not a dotted string: `adminUi.login.messages` is keyed *by*
 * dotted keys (`'admin.auth.invalid'`), and joining those into a path and
 * splitting it again walks to the wrong place — which is exactly what the
 * blank-value check caught the first time it ran.
 */
function leafPaths(value: unknown, prefix: string[] = []): string[][] {
  if (value === null || typeof value !== 'object') return [prefix];
  return Object.entries(value as Node).flatMap(([key, child]) =>
    leafPaths(child, [...prefix, key]),
  );
}

/** Reads a leaf by its segments. */
function at(dict: unknown, path: string[]): unknown {
  return path.reduce<unknown>((node, part) => (node as Node | undefined)?.[part], dict);
}

/** Walks `errors.field.tooShort` to its value, the way the resolvers do. */
function resolve_(dict: unknown, path: string): unknown {
  return at(dict, path.split('.'));
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort();
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

/**
 * Every `'errors.…'` / `'admin.…'` literal in `src/`, with the file it came
 * from. A regex over the tree rather than an AST walk: this runs in Node, the
 * keys are always plain single-quoted literals, and a false positive would
 * only make the test stricter.
 */
function referencedKeys(namespace: 'errors' | 'admin'): Map<string, string[]> {
  const pattern = new RegExp(`['"\`](${namespace}\\.[A-Za-z0-9_.]+)['"\`]`, 'g');
  const found = new Map<string, string[]>();

  for (const file of sourceFiles(SRC)) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    // The dictionaries themselves quote key names in comments and, in the
    // login form's message map, as object keys.
    if (rel.startsWith('src/lib/i18n/')) continue;
    for (const match of readFileSync(file, 'utf8').matchAll(pattern)) {
      const key = match[1];
      if (!key) continue;
      found.set(key, [...(found.get(key) ?? []), rel]);
    }
  }
  return found;
}

/**
 * Keys built from a template rather than written out, so the regex above
 * cannot see them. `actions/public/forms.ts` and `api/admin/media/route.ts`
 * both emit `errors.upload.${reason}` where `reason` is `UploadRejection`.
 */
const TEMPLATED_KEYS = [
  'errors.upload.too_large',
  'errors.upload.bad_type',
  'errors.upload.empty',
  'errors.upload.unreadable',
];

/**
 * `admin.auth.*` is resolved by `adminUi.login.messages`, not by
 * `resolveAdminKey`, and the login form falls back to `errors.unexpected`
 * for anything it does not recognise. It is the one key family that lives
 * outside `dict.admin` on purpose.
 */
const LOGIN_MESSAGE_KEYS = ['admin.auth.invalid', 'admin.auth.deactivated'];

describe('dictionary shape', () => {
  const arPaths = leafPaths(ar);
  const enPaths = leafPaths(en);
  const arLabels = arPaths.map((path) => path.join(' › ')).sort();
  const enLabels = enPaths.map((path) => path.join(' › ')).sort();

  it('ships exactly the locales the config declares', () => {
    expect([...LOCALES]).toEqual(['ar', 'en']);
  });

  it('carries the same keys in both locales', () => {
    expect(enLabels.filter((path) => !arLabels.includes(path))).toEqual([]);
    expect(arLabels.filter((path) => !enLabels.includes(path))).toEqual([]);
  });

  it('has no empty or whitespace-only string', () => {
    for (const [locale, dict] of [
      ['ar', ar],
      ['en', en],
    ] as const) {
      const blank = leafPaths(dict)
        .filter((path) => {
          const value = at(dict, path);
          return typeof value !== 'string' || value.trim() === '';
        })
        .map((path) => path.join(' › '));
      expect(blank, `${locale} has blank values`).toEqual([]);
    }
  });

  it('uses the same placeholders in both locales', () => {
    const mismatched = arPaths
      .filter((path) => {
        const left = at(ar, path);
        const right = at(en, path);
        if (typeof left !== 'string' || typeof right !== 'string') return false;
        return placeholders(left).join(',') !== placeholders(right).join(',');
      })
      .map((path) => path.join(' › '));
    expect(mismatched).toEqual([]);
  });

  it('never leaves an Arabic value equal to its English one for prose', () => {
    // Proper nouns and codes are legitimately identical ('English', 'X').
    // Anything longer than four words that matches exactly is an untranslated
    // paste, not a shared token.
    const suspicious = arPaths
      .filter((path) => {
        const left = at(ar, path);
        const right = at(en, path);
        return (
          typeof left === 'string' && left === right && left.trim().split(/\s+/).length > 4
        );
      })
      .map((path) => path.join(' › '));
    expect(suspicious).toEqual([]);
  });
});

describe('keys the code throws', () => {
  const errorKeys = referencedKeys('errors');
  const adminKeys = referencedKeys('admin');

  it('finds the error keys it is supposed to check', () => {
    // A refactor that stopped the scan finding anything would make every
    // assertion below vacuously pass.
    expect(errorKeys.size).toBeGreaterThan(20);
  });

  it('resolves every errors.* key referenced in src/ in both locales', () => {
    const unresolved: string[] = [];
    for (const [key, files] of [
      ...errorKeys,
      ...TEMPLATED_KEYS.map((key) => [key, ['(built from UploadRejection)']] as const),
    ]) {
      for (const [locale, dict] of [
        ['ar', ar],
        ['en', en],
      ] as const) {
        if (typeof resolve_(dict, key) !== 'string') {
          unresolved.push(`${locale}: ${key} (${files.join(', ')})`);
        }
      }
    }
    expect(unresolved).toEqual([]);
  });

  it('resolves every admin.* key an action returns in both locales', () => {
    const unresolved: string[] = [];
    for (const [key, files] of adminKeys) {
      if (LOGIN_MESSAGE_KEYS.includes(key)) continue;
      for (const [locale, dict] of [
        ['ar', ar],
        ['en', en],
      ] as const) {
        if (typeof resolve_(dict, key) !== 'string') {
          unresolved.push(`${locale}: ${key} (${files.join(', ')})`);
        }
      }
    }
    expect(unresolved).toEqual([]);
  });

  it('keeps the login form able to name every key it is handed', () => {
    const messages: Record<string, string> = ar.adminUi.login.messages;
    for (const key of [...LOGIN_MESSAGE_KEYS, 'errors.validation', 'errors.unexpected']) {
      expect(messages[key], key).toBeTypeOf('string');
    }
  });

  it('covers every UploadRejection reason', () => {
    // `errors.upload.${reason}` is only as safe as this list. If a reason is
    // added to `UploadRejection`, this fails before a visitor sees the raw key.
    const source = readFileSync(join(SRC, 'lib/security/upload.ts'), 'utf8');
    const union = /export type UploadRejection =([^;]+);/.exec(source)?.[1] ?? '';
    const reasons = [...union.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
    expect(reasons.length).toBeGreaterThan(0);
    for (const reason of reasons) {
      expect(TEMPLATED_KEYS, reason).toContain(`errors.upload.${reason}`);
      expect(resolve_(ar, `errors.upload.${reason}`)).toBeTypeOf('string');
      expect(resolve_(en, `errors.upload.${reason}`)).toBeTypeOf('string');
    }
  });
});
