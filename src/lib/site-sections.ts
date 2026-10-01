/**
 * The first path segment of every route under `src/app/(site)/[locale]/`.
 *
 * `src/proxy.ts` answers an unknown first segment with a 404 status while the
 * catch-all route renders the designed not-found page inside the site layout
 * (see `[...notFound]/page.tsx`). The proxy cannot read the filesystem at
 * request time, so the list is written out here — and
 * `tests/unit/site-sections.test.ts` fails the moment it disagrees with the
 * directories, so adding a section without adding it here cannot ship.
 *
 * The metadata image routes (`opengraph-image-<hash>`, `twitter-image-<hash>`)
 * are matched by prefix, because Next appends a build hash to their segment.
 */
export const SITE_SECTIONS: ReadonlySet<string> = new Set([
  'about',
  'apply',
  'careers',
  'contact',
  'get-involved',
  'impact',
  'legal',
  'news',
  'partners',
  'programs',
  'projects',
  'resources',
  'verify',
]);

const IMAGE_ROUTE_PREFIXES = ['opengraph-image', 'twitter-image'] as const;

/** Whether `segment` — the one after the locale — names a real site section. */
export function isSiteSection(segment: string): boolean {
  return (
    SITE_SECTIONS.has(segment) || IMAGE_ROUTE_PREFIXES.some((prefix) => segment.startsWith(prefix))
  );
}
