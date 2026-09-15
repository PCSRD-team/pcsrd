import { getOrganization } from '@/db/queries/content';
import { prerenderData } from '@/lib/build-time';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n/config';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/seo/og';

/**
 * The site-wide Open Graph card — every route under `[locale]` that has no
 * `opengraph-image.tsx` of its own shares it (lists, about, contact, verify).
 *
 * The organisation's short name is the title, its short description the
 * eyebrow; both come from `organization_settings`, so a rename in the admin
 * changes every card on the next revalidation.
 *
 * `generateImageMetadata` sets `alt` per locale. The alt text is the
 * organisation's name — a description of what the card *shows* — because the
 * dictionaries carry no `seo` namespace yet (requested in the migration note;
 * switch to `dict.seo.ogImageAlt` when it lands).
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
