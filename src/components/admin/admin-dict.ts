import { ar, type Dictionary } from '@/lib/i18n/dictionaries/ar';

/**
 * The admin's dictionary.
 *
 * The admin is Arabic-only (05-ADMIN §2), so there is no locale to resolve —
 * the Arabic file is imported directly rather than through `getDictionary`,
 * which is `server-only` and would refuse the client forms that need to turn
 * an `ActionResult.messageKey` into a sentence.
 *
 * `AdminFormDict` is the slice a Client Component receives: `errors` for the
 * keys services throw, `admin` for the keys actions return. Nothing else from
 * the dictionary crosses into the browser bundle.
 */
export type AdminFormDict = Pick<Dictionary, 'errors' | 'admin'>;

export const adminDict = ar.admin;

export function adminFormDict(): AdminFormDict {
  return { errors: ar.errors, admin: ar.admin };
}

/**
 * Walks `errors.media.altRequired` to its string. An unknown key renders
 * verbatim, which is visibly wrong rather than invisibly blank.
 */
export function resolveAdminKey(dict: AdminFormDict, key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict);
  return typeof value === 'string' ? value : key;
}

/** True when the key exists — used to refuse an arbitrary query-string key. */
export function isAdminKey(dict: AdminFormDict, key: string): boolean {
  return resolveAdminKey(dict, key) !== key;
}
