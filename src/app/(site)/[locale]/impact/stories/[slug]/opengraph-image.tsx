import { ogImageMetadata, ogLocaleOf, recordOgCard } from '@/components/content/og';
import { getStoryBySlug } from '@/db/queries/content';
import { prerenderData } from '@/lib/build-time';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { OG_CONTENT_TYPE, OG_SIZE } from '@/lib/seo/og';

/** The card for one impact story. */

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 3600;

type Params = { locale: string; slug: string };

export async function generateImageMetadata({ params }: { params: Params }) {
  const locale = ogLocaleOf(params.locale);
  const story = await prerenderData('og story', () => getStoryBySlug(params.slug, locale), null);
  return ogImageMetadata(story?.title);
}

export default async function Image({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug } = await params;
  const locale = ogLocaleOf(raw);
  const [story, dict] = await Promise.all([
    prerenderData('og story', () => getStoryBySlug(slug, locale), null),
    getDictionary(locale),
  ]);

  return recordOgCard({ locale, record: story, eyebrow: dict.impact.storiesTitle });
}
