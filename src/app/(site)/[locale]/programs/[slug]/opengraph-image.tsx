import { ogImageMetadata, ogLocaleOf, recordOgCard } from '@/components/content/og';
import { getProgramBySlug } from '@/db/queries/content';
import { prerenderData } from '@/lib/build-time';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { OG_CONTENT_TYPE, OG_SIZE } from '@/lib/seo/og';
import { decodeParam } from '@/lib/route-params';

/** The card for one programme: the 2px rule takes the programme's own colour. */

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 3600;

type Params = { locale: string; slug: string };

export async function generateImageMetadata({ params }: { params: Params }) {
  const locale = ogLocaleOf(params.locale);
  // The build calls this once with no slug while collecting page data; a
  // query with an undefined parameter is refused, so skip it rather than log
  // a failed query for every route. At runtime the slug arrives
  // percent-encoded like the page's own — see `lib/route-params`.
  const slug = params.slug ? decodeParam(params.slug) : '';
  if (!slug) return ogImageMetadata(undefined);
  const program = await prerenderData('og program', () => getProgramBySlug(slug, locale), null);
  return ogImageMetadata(program?.title);
}

export default async function Image({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug: rawSlug } = await params;
  const slug = decodeParam(rawSlug);
  const locale = ogLocaleOf(raw);
  const [program, dict] = await Promise.all([
    prerenderData('og program', () => getProgramBySlug(slug, locale), null),
    getDictionary(locale),
  ]);

  return recordOgCard({
    locale,
    record: program,
    eyebrow: dict.programs.title,
    accent: program?.accentToken,
  });
}
