import { getOgMedia, getOrganization } from '@/db/queries/content';
import { prerenderData } from '@/lib/build-time';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n/config';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage, serveStoredOgImage } from '@/lib/seo/og';

/**
 * The shared body of every per-template `opengraph-image.tsx` under the
 * content routes (programmes, projects, posts, stories, vacancies).
 *
 * Each route file keeps only what differs — which query loads the record and
 * which dictionary key is the eyebrow — and hands the rest here, so the
 * "editor-chosen card wins over the rendered one" rule and the site-name
 * resolution are written once rather than five times.
 *
 * No organisation facts live here: the site name is read from
 * `organization_settings` on every render (RULE 6).
 */

export type OgRecord = {
  title: string | null;
  ogMediaId?: string | null;
};

export function ogLocaleOf(raw: string): Locale {
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

/** `generateImageMetadata` return value: one card, `alt` = the record title. */
export function ogImageMetadata(alt: string | null | undefined) {
  return [{ id: 'card', alt: alt ?? '', size: OG_SIZE, contentType: OG_CONTENT_TYPE }];
}

export async function ogSiteName(locale: Locale): Promise<string> {
  const org = await prerenderData('og org', () => getOrganization(locale), null);
  return org?.shortName ?? org?.legalName ?? org?.acronym ?? '';
}

/**
 * Serves the record's card. An `og_media_id` chosen in the admin is served
 * as-is (cropped to 1200×630); otherwise the design-system card is rendered
 * with the record title, the section eyebrow and the programme accent.
 */
export async function recordOgCard({
  locale,
  record,
  eyebrow,
  accent,
}: {
  locale: Locale;
  record: OgRecord | null;
  /** The section name shown above the title; `null` renders the plain site card. */
  eyebrow: string | null;
  /** A programme `accent_token` (`--color-prog-*`) or a hex colour. */
  accent?: string | null;
}): Promise<Response> {
  const siteName = await ogSiteName(locale);

  if (record?.ogMediaId) {
    const media = await getOgMedia(record.ogMediaId);
    const stored = media ? await serveStoredOgImage(media) : null;
    if (stored) return stored;
  }

  return renderOgImage({
    locale,
    title: record?.title ?? siteName,
    eyebrow: record ? eyebrow : null,
    siteName,
    accent: record ? accent : null,
  });
}
