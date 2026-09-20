import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { postCategoryLabel } from '@/components/content/cards';
import { mediaImage, mediaSrc } from '@/components/content/media';
import { ContentBreadcrumbs, TranslationNotice } from '@/components/content/page-chrome';
import { RichText } from '@/components/content/rich-text';
import { getSiteName, toTranslationStatus } from '@/components/content/site';
import { ArticleJsonLd } from '@/components/seo/json-ld';
import { DateText } from '@/components/ui/bidi';
import { Figure } from '@/components/ui/figure';
import { Container, PageHeader } from '@/components/ui/layout';
import { Meta, Prose } from '@/components/ui/typography';
import { getPostBySlug, listPostSlugs } from '@/db/queries/content';
import { prerenderData } from '@/lib/build-time';
import { formatDate } from '@/lib/format';
import { isLocale, localePath } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export async function generateStaticParams() {
  const rows = await prerenderData('static params posts', () => listPostSlugs(), []);
  return rows.flatMap((row) => [
    { locale: 'ar', slug: row.slugAr },
    ...(row.translationStatus === 'ar_only' ? [] : [{ locale: 'en', slug: row.slugEn }]),
  ]);
}

export async function generateMetadata({ params }: PageProps<'/[locale]/news/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const [post, siteName] = await Promise.all([getPostBySlug(slug, locale), getSiteName(locale)]);
  if (!post) return {};

  // SEO-013: the English SEO title is read on English pages, falling back to Arabic.
  const seoTitle = locale === 'ar' ? post.seoTitleAr : post.seoTitleEn?.trim() || post.seoTitleAr;
  const seoDescription =
    locale === 'ar' ? post.seoDescriptionAr : post.seoDescriptionEn?.trim() || post.seoDescriptionAr;

  return buildMetadata({
    locale,
    path: { ar: `/news/${post.slugAr}`, en: `/news/${post.slugEn}` },
    title: seoTitle?.trim() || post.title?.trim() || siteName,
    description: seoDescription ?? post.excerpt,
    siteName,
    type: 'article',
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
    translationStatus: toTranslationStatus(post.translationStatus),
    noIndex: post.noIndex,
  });
}

export default async function PostPage({ params }: PageProps<'/[locale]/news/[slug]'>) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, post] = await Promise.all([getDictionary(locale), getPostBySlug(slug, locale)]);
  if (!post) notFound();

  const hero = mediaImage(post.hero?.path, post.hero?.blur, post.hero);
  const showUpdated =
    post.publishedAt && post.updatedAt.getTime() - post.publishedAt.getTime() > 24 * 60 * 60 * 1000;

  return (
    <Container size="narrow" className="section-gap">
      <ArticleJsonLd
        title={post.title}
        description={post.excerpt}
        url={localePath(locale, `/news/${slug}`)}
        locale={locale}
        publishedAt={post.publishedAt}
        updatedAt={post.updatedAt}
        image={
          post.hero
            ? { url: mediaSrc(post.hero.path), width: post.hero.width, height: post.hero.height, alt: post.hero.alt }
            : null
        }
      />

      <TranslationNotice locale={locale} dict={dict} isTranslated={post.isTranslated} arabicPath={`/news/${post.slugAr}`} />

      <article>
        <PageHeader
          breadcrumbs={
            <ContentBreadcrumbs
              locale={locale}
              dict={dict}
              trail={[{ label: dict.news.title, path: '/news' }, { label: post.title ?? '' }]}
            />
          }
          eyebrow={postCategoryLabel(post.category, dict)}
          title={post.title ?? ''}
          lede={post.excerpt}
          meta={
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {post.publishedAt ? (
                <Meta as="p">
                  {dict.news.publishedOn}{' '}
                  <time dateTime={post.publishedAt.toISOString()}>
                    <DateText locale={locale}>{formatDate(post.publishedAt, locale)}</DateText>
                  </time>
                </Meta>
              ) : null}
              {showUpdated ? (
                <Meta as="p">
                  {dict.contentUi.updatedOn}{' '}
                  <time dateTime={post.updatedAt.toISOString()}>
                    <DateText locale={locale}>{formatDate(post.updatedAt, locale)}</DateText>
                  </time>
                </Meta>
              ) : null}
            </div>
          }
        />

        {hero ? (
          <Figure
            image={hero}
            alt={post.hero?.alt ?? ''}
            decorative={!post.hero?.alt}
            // The narrow container caps at 760px, but it only *reaches* 760px
            // once the viewport clears 760 + the 2×64px desktop gutter. Below
            // 888px the column is narrower than the old hint claimed.
            sizes="(min-width: 888px) 760px, 100vw"
            // The article's hero, and the only `preload` on this route.
            preload
            className="mbe-10"
          />
        ) : null}

        <Prose measure="reading">
          <RichText doc={post.body} />
        </Prose>
      </article>
    </Container>
  );
}
