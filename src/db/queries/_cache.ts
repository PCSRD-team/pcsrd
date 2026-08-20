import { unstable_cache } from 'next/cache';

/**
 * Wraps a query in `unstable_cache`.
 *
 * Every query module exports **two** functions: the raw one, prefixed with an
 * underscore, and the cached one. The raw function is what a test, a seed
 * script or a cron job calls — `unstable_cache` needs a Next request scope and
 * throws without one, so a module that only exported the cached version would
 * be unreachable from anywhere but a page.
 *
 * `use cache` supersedes this in Next 16, but it requires `cacheComponents`,
 * which cannot be enabled here: it makes `unstable_cache`,
 * `export const revalidate` and `force-dynamic` all throw, and the caching
 * design in 02-API depends on all three.
 */

/** One hour. Content changes by publish, which busts the tag immediately. */
export const DEFAULT_REVALIDATE = 3600;

export function cached<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyParts: string[],
  options: { tags: string[]; revalidate?: number },
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) =>
    unstable_cache(() => fn(...args), [...keyParts, ...args.map(stableKey)], {
      tags: options.tags,
      revalidate: options.revalidate ?? DEFAULT_REVALIDATE,
    })();
}

/**
 * Arguments become part of the cache key, so they have to serialise the same
 * way every time. `JSON.stringify` on an object is key-order dependent, which
 * would give `{a,b}` and `{b,a}` two entries for one result.
 */
function stableKey(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${stableKey(v)}`);
  return `{${entries.join(',')}}`;
}
