import { revalidateTag } from 'next/cache';
import { type Entity, tagsFor } from './tags';

/**
 * The only place in the codebase that calls `revalidateTag`.
 *
 * Next 16 made the second argument **required**, and the choice between its two
 * values is a product decision, not a detail:
 *
 * - `{ expire: 0 }` — drop the entry now. The next visitor waits for a fresh
 *   render and sees current content.
 * - `'max'` — stale-while-revalidate. The next visitor is served the **old**
 *   page while the new one builds.
 *
 * The default is `{ expire: 0 }` because 06-BUILD-PLAN §7 requires a published
 * change to be visible "within seconds", and `'max'` shows the previous version
 * to exactly the person most likely to be checking. `'max'` is reserved for the
 * bulk cron paths, where hundreds of tags drop at once and a brief stale window
 * is cheaper than a thundering herd.
 */
export type RevalidateMode = 'immediate' | 'stale';

export function revalidate(tags: string[], mode: RevalidateMode = 'immediate') {
  for (const tag of tags) {
    if (mode === 'stale') revalidateTag(tag, 'max');
    else revalidateTag(tag, { expire: 0 });
  }
}

/**
 * Invalidate everything a mutation of one entity affects.
 *
 * Called from the action layer, never from a service: `revalidateTag` is a Next
 * runtime concern, and importing `next/cache` into a service would make that
 * service untestable outside a request scope.
 */
export function revalidateEntity(
  entity: Entity,
  keys?: { ar?: string | null; en?: string | null },
  mode?: RevalidateMode,
) {
  revalidate(tagsFor(entity, keys), mode);
}
