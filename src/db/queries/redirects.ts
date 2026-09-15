import { db } from '@/db';
import { redirects } from '@/db/schema';
import { TAGS } from '@/lib/cache/tags';
import { cached } from './_cache';

/**
 * The redirects table as one array, for `src/proxy.ts`.
 *
 * Read by the proxy on every request that is not an asset, an API call or an
 * admin page, so the shape is chosen for that: the **whole table** in one
 * cache entry, keyed by nothing. A per-path lookup would put one cache read —
 * and on a miss one database query — in front of every distinct URL. With one
 * entry, a warm cache costs one read of a small JSON array and a `Map` lookup;
 * the database is hit once per hour or once per save, whichever comes first.
 *
 * `redirects.rt_select` is `using (true)`, so `anon` reads every row — no actor
 * is bound, which is the same identity a visitor has.
 */
export type RedirectRule = {
  sourcePath: string;
  destinationPath: string;
  statusCode: number;
};

export async function _listRedirectRules(): Promise<RedirectRule[]> {
  return db
    .select({
      sourcePath: redirects.sourcePath,
      destinationPath: redirects.destinationPath,
      statusCode: redirects.statusCode,
    })
    .from(redirects);
}

export const listRedirectRules = cached(_listRedirectRules, ['redirects', 'all'], {
  tags: [TAGS.redirectList],
});
