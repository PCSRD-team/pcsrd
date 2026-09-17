import { ogImageMetadata, ogLocaleOf, recordOgCard } from '@/components/content/og';
import { getVacancyBySlug } from '@/db/queries/content';
import { prerenderData } from '@/lib/build-time';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { OG_CONTENT_TYPE, OG_SIZE } from '@/lib/seo/og';

/** The card for one vacancy. */

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 3600;

type Params = { locale: string; slug: string };

export async function generateImageMetadata({ params }: { params: Params }) {
  const locale = ogLocaleOf(params.locale);
  const vacancy = await prerenderData('og vacancy', () => getVacancyBySlug(params.slug, locale), null);
  return ogImageMetadata(vacancy?.title);
}

export default async function Image({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug } = await params;
  const locale = ogLocaleOf(raw);
  const [vacancy, dict] = await Promise.all([
    prerenderData('og vacancy', () => getVacancyBySlug(slug, locale), null),
    getDictionary(locale),
  ]);

  return recordOgCard({ locale, record: vacancy, eyebrow: dict.careers.title });
}
