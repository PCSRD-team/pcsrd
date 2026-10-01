import { getOrganization } from '@/db/queries/content';
import { prerenderData } from '@/lib/build-time';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n/config';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/seo/og';

/**
 * The site-wide Open Graph card, used by every route under `[locale]` that
 * has no `opengraph-image.tsx` of its own (lists, about, contact, verify).
 *
 * It does **not** reach them by inheritance. A file card is merged only into
 * its own segment's metadata, and each page's `generateMetadata` declares
 * `openGraph`, which replaces the layout's object wholesale. `buildMetadata`
 * therefore names this card by URL (`siteCardImage` / `SITE_CARD_SEGMENT` in
 * `src/lib/seo/metadata.ts`); moving or renaming this file, or changing the
 * `id` below, has to be matched there — `tests/unit/seo-site-card.test.ts`
 * catches the first two.
 *
 * The organisation's short name is the title, its short description the
 * eyebrow; both come from `organization_settings`, so a rename in the admin
 * changes every card on the next revalidation.
 *
 * `generateImageMetadata` sets `alt` per locale to the organisation's name,
 * the same text `buildMetadata` gives the card when it names it explicitly, so
 * the `og:image:alt` a page emits does not depend on which path produced it.
 */

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 3600;

type Params = { locale: string };

async function organizationFor(locale: Locale) {
  return prerenderData(`opengraph-image ${locale}`, () => getOrganization(locale), null);
}

/** Never a hardcoded name: an unconfigured organisation renders an empty title, not a placeholder. */
function siteNameOf(org: Awaited<ReturnType<typeof organizationFor>>): string {
  return org?.shortName ?? org?.legalName ?? org?.acronym ?? '';
}

export async function generateImageMetadata({ params }: { params: Params }) {
  const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const org = await organizationFor(locale);
  return [
    {
      id: 'default',
      alt: siteNameOf(org),
      size: OG_SIZE,
      contentType: OG_CONTENT_TYPE,
    },
  ];
}

export default async function Image({ params }: { params: Promise<Params> }) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const org = await organizationFor(locale);
  const siteName = siteNameOf(org);

  return renderOgImage({
    locale,
    title: siteName,
    eyebrow: org?.shortDescription ?? null,
    siteName: org?.legalName ?? siteName,
  });
}
