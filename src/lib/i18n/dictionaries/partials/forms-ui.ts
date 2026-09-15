/**
 * Dictionary partial — `forms-ui`.
 *
 * Partials exist so several areas of the site can grow their copy at once
 * without editing the two root dictionaries. Each partial owns one top-level
 * namespace per key below; the root files spread them in. The English object
 * is typed from the Arabic one, so a key added on one side and forgotten on
 * the other is a build error.
 */
export const forms_uiAr = {} as const satisfies Record<string, Record<string, unknown>>;

type Shape = { [K in keyof typeof forms_uiAr]: (typeof forms_uiAr)[K] };

export const forms_uiEn: Shape = {};
