/**
 * Cache tag vocabulary (02-API §4.6).
 *
 * **Zero imports, by design.** Services and tests need to name a tag; neither
 * may import `next/cache`. Keeping the vocabulary dependency-free is what lets
 * both sides agree on a string without agreeing on a runtime. The function that
 * actually invalidates lives in `./revalidate.ts`, which does import Next.
 *
 * There is no separate `home` tag: the homepage composes its sections from the
 * same cached list queries as every other page, so busting `project:list` busts
 * the homepage's project section with it.
 */

export const TAGS = {
  orgSettings: 'org:settings',

  programList: 'program:list',
  program: (slug: string) => `program:${slug}`,

  projectList: 'project:list',
  project: (slug: string) => `project:${slug}`,

  postList: 'post:list',
  post: (slug: string) => `post:${slug}`,

  storyList: 'story:list',
  story: (slug: string) => `story:${slug}`,

  vacancyList: 'vacancy:list',
  vacancy: (slug: string) => `vacancy:${slug}`,

  publicationList: 'publication:list',
  publication: (slug: string) => `publication:${slug}`,

  partnerList: 'partner:list',
  metricList: 'metric:list',
  personList: 'person:list',

  pageList: 'page:list',
  page: (key: string) => `page:${key}`,

  mediaList: 'media:list',
  /**
   * The whole redirects table as one cached array, read by `src/proxy.ts` on
   * every non-asset request and busted by the redirects action. One tag, one
   * entry: the proxy must never pay a per-request query.
   */
  redirectList: 'redirect:list',
} as const;

/** Entities that have both a list tag and a per-slug tag. */
export type SluggedEntity =
  | 'program'
  | 'project'
  | 'post'
  | 'story'
  | 'vacancy'
  | 'publication'
  | 'page';

/** Entities that only have a list tag. */
export type FlatEntity = 'partner' | 'metric' | 'person' | 'media' | 'redirect' | 'orgSettings';

export type Entity = SluggedEntity | FlatEntity;

const LIST_TAG: Record<Entity, string> = {
  program: TAGS.programList,
  project: TAGS.projectList,
  post: TAGS.postList,
  story: TAGS.storyList,
  vacancy: TAGS.vacancyList,
  publication: TAGS.publicationList,
  page: TAGS.pageList,
  partner: TAGS.partnerList,
  metric: TAGS.metricList,
  person: TAGS.personList,
  media: TAGS.mediaList,
  redirect: TAGS.redirectList,
  orgSettings: TAGS.orgSettings,
};

const ITEM_TAG: Record<SluggedEntity, (key: string) => string> = {
  program: TAGS.program,
  project: TAGS.project,
  post: TAGS.post,
  story: TAGS.story,
  vacancy: TAGS.vacancy,
  publication: TAGS.publication,
  page: TAGS.page,
};

function isSlugged(entity: Entity): entity is SluggedEntity {
  return entity in ITEM_TAG;
}

/**
 * Every tag a mutation of `entity` must invalidate.
 *
 * **Both slugs are always busted.** `/ar/projects/x` and `/en/projects/y` are
 * two separate cache entries for the same row; invalidating only the locale the
 * editor happened to be working in leaves the other one stale, which is the
 * failure that looks like "the fix didn't deploy".
 *
 * Cross-entity edges are included because a card carries its parent's name: a
 * project card shows its programme title, and a story or post can point at a
 * project.
 */
export function tagsFor(entity: Entity, keys?: { ar?: string | null; en?: string | null }): string[] {
  const tags = [LIST_TAG[entity]];

  if (isSlugged(entity)) {
    if (keys?.ar) tags.push(ITEM_TAG[entity](keys.ar));
    if (keys?.en) tags.push(ITEM_TAG[entity](keys.en));
  }

  if (entity === 'project') tags.push(TAGS.programList);
  if (entity === 'story' || entity === 'post') tags.push(TAGS.projectList);
  if (entity === 'orgSettings') tags.push(TAGS.pageList);
  if (entity === 'media') tags.push(TAGS.partnerList, TAGS.personList);

  return [...new Set(tags)];
}

/**
 * The tags a **detail query** registers: the item's own tag plus its list
 * tag. Registered, not just computed — `cached()` accepts a function of the
 * query's arguments so the slug reaches `unstable_cache`.
 *
 * The list tag is kept alongside the item tag on purpose. A status change
 * from `published` to `archived` is revalidated by the admin action with both
 * slugs, but a bulk path (the archive cron in `'stale'` mode, a seed, a
 * restore) may only bust the list; the list tag on the detail entry is what
 * keeps that path correct too.
 */
export function detailTags(entity: SluggedEntity, key: string): string[] {
  return [ITEM_TAG[entity](key), LIST_TAG[entity]];
}
