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

/**
 * `tags` is either a fixed list (a list query) or a function of the call's
 * arguments (a detail query), so `getPostBySlug('x', 'ar')` can register
 * `post:x` alongside `post:list`. Before this, every detail query registered
 * only its list tag and the per-slug tags in `tags.ts` were computed and
 * revalidated but registered by nothing (ARCH-009 / NEXT-007): an edit
 * dropped every cached post page instead of its own. The function form is what
 * makes the granularity real.
 */
/**
 * What `unstable_cache` gives back, as opposed to what was put in.
 *
 * The cache stores its value as JSON, so a `Date` returned by a query comes
 * back from a cache **hit** as an ISO string, while a **miss** passes the real
 * `Date` straight through. The types said `Date` either way, so
 * `post.publishedAt.toISOString()` typechecked, worked on the first request of
 * a deploy, and threw `TypeError: post.publishedAt.toISOString is not a
 * function` on the second — the homepage, the news list, both detail routes
 * and two cards, all 500ing on a warm cache only.
 *
 * Declaring the boundary honestly turns that class of bug into a compile
 * error. `formatDate`, `formatPeriod` and `<time dateTime>` all accept a
 * string already, so honesty costs the consumers nothing.
 */
export type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;

export function cached<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyParts: string[],
  options: { tags: string[] | ((...args: TArgs) => string[]); revalidate?: number },
): (...args: TArgs) => Promise<Serialized<TResult>> {
  return (...args: TArgs) =>
    unstable_cache(() => fn(...args) as Promise<Serialized<TResult>>, [...keyParts, ...args.map(stableKey)], {
      tags: typeof options.tags === 'function' ? options.tags(...args) : options.tags,
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
