/**
 * Dictionary partial — `site-content`.
 *
 * Partials exist so several areas of the site can grow their copy at once
 * without editing the two root dictionaries. Each partial owns one top-level
 * namespace per key below; the root files spread them in. The English object
 * is typed from the Arabic one, so a key added on one side and forgotten on
 * the other is a build error.
 */
export const site_contentAr = {} as const satisfies Record<string, Record<string, unknown>>;

type Shape = { [K in keyof typeof site_contentAr]: (typeof site_contentAr)[K] };

export const site_contentEn: Shape = {};
