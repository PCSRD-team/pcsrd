import { ogImageMetadata, ogLocaleOf, recordOgCard } from '@/components/content/og';
import { getPostBySlug } from '@/db/queries/content';
import { prerenderData } from '@/lib/build-time';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { OG_CONTENT_TYPE, OG_SIZE } from '@/lib/seo/og';

/** The card for one news post: category eyebrow, title, site name. */

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 3600;

type Params = { locale: string; slug: string };

export async function generateImageMetadata({ params }: { params: Params }) {
  const locale = ogLocaleOf(params.locale);
  const post = await prerenderData('og post', () => getPostBySlug(params.slug, locale), null);
  return ogImageMetadata(post?.title);
}

export default async function Image({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug } = await params;
  const locale = ogLocaleOf(raw);
  const [post, dict] = await Promise.all([
    prerenderData('og post', () => getPostBySlug(slug, locale), null),
    getDictionary(locale),
  ]);

  const eyebrow = post
    ? {
        news: dict.news.categoryNews,
        statement: dict.news.categoryStatement,
        announcement: dict.news.categoryAnnouncement,
      }[post.category]
    : null;

  return recordOgCard({ locale, record: post, eyebrow });
}
