import type { MetadataRoute } from 'next';
import { getOrganization } from '@/db/queries/content';
import { prerenderData } from '@/lib/build-time';
import { DEFAULT_LOCALE, DIR, HTML_LANG } from '@/lib/i18n/config';

/**
 * The web app manifest, served at `/manifest.webmanifest`.
 *
 * Names and description come from `organization_settings` in the default
 * locale (RULE 6) — never a literal; an unconfigured organisation yields an
 * empty name rather than a placeholder. The colours are the design system's
 * paper and ink, not organisation facts.
 *
 * No `icons` yet: the only icon in the repo is `favicon.ico`, and a manifest
 * that points at a 16px favicon for a 192px launcher slot is worse than none.
 * Add 192/512 PNGs next to this file (`icon.png` / `apple-icon.png` file
 * conventions) and list them here.
 *
 * `src/proxy.ts` must exclude `/manifest.webmanifest`, or the request is
 * redirected to `/ar/manifest.webmanifest` and 404s.
 */
export const revalidate = 3600;

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const org = await prerenderData('manifest organisation', () => getOrganization(DEFAULT_LOCALE), null);
  const name = org?.legalName?.trim() || org?.shortName?.trim() || org?.acronym?.trim() || '';
  const shortName = org?.acronym?.trim() || org?.shortName?.trim() || name;

  return {
    name,
    short_name: shortName,
    description: org?.shortDescription?.trim() || undefined,
    lang: HTML_LANG[DEFAULT_LOCALE],
    dir: DIR[DEFAULT_LOCALE],
    start_url: `/${DEFAULT_LOCALE}`,
    scope: '/',
    display: 'browser',
    background_color: '#FBFAF6',
    theme_color: '#14213F',
  };
}
