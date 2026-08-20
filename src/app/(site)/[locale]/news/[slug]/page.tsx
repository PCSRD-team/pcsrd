import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { RichText } from '@/components/content/rich-text';
import { ArticleJsonLd } from '@/components/seo/json-ld';
import { Bidi } from '@/components/ui/bidi';
import { Prose } from '@/components/ui/primitives';
import { UntranslatedNotice } from '@/components/ui/states';
import { getPostBySlug } from '@/db/queries/content';
import { publicEnv } from '@/lib/env.public';
import { formatDate, storageUrl } from '@/lib/format';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/news/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const post = await getPostBySlug(slug, locale);
  if (!post) return {};

  return {
    title: (locale === 'ar' ? post.seoTitleAr : post.seoTitleEn) ?? post.title ?? undefined,
    description:
      (locale === 'ar' ? post.seoDescriptionAr : post.seoDescriptionEn) ??
      post.excerpt ??
      undefined,
    robots: post.noIndex ? { index: false, follow: false } : undefined,
    alternates: {
      canonical: `/${locale}/news/${slug}`,
      languages: { ar: `/ar/news/${post.slugAr}`, en: `/en/news/${post.slugEn}` },
    },
    openGraph: {
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
    },
  };
}

export default async function PostPage({ params }: PageProps<'/[locale]/news/[slug]'>) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, post] = await Promise.all([getDictionary(locale), getPostBySlug(slug, locale)]);
  if (!post) notFound();

  const categoryLabel = {
    news: dict.news.categoryNews,
    statement: dict.news.categoryStatement,
    announcement: dict.news.categoryAnnouncement,
  }[post.category];

  return (
    <article className="container-content section-gap">
      <ArticleJsonLd
        title={post.title}
        description={post.excerpt}
        publishedAt={post.publishedAt}
        url={`${publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/${locale}/news/${slug}`}
        locale={locale}
      />

      {!post.isTranslated ? (
        <UntranslatedNotice
          title={dict.states.untranslatedTitle}
          body={dict.states.untranslatedBody}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <p className="eyebrow">{categoryLabel}</p>
        {post.publishedAt ? (
          <time
            dateTime={post.publishedAt.toISOString()}
            className="font-mono text-caption text-mono-muted"
          >
            <Bidi>{formatDate(post.publishedAt, locale)}</Bidi>
          </time>
        ) : null}
      </div>

      <h1 className="mbs-4 text-h1 font-semibold text-ink">{post.title}</h1>
      <span className="rule-mark mbs-5 block" aria-hidden="true" />

      {post.excerpt ? (
        <p className="measure-lead mbs-6 text-lead text-ink-70">{post.excerpt}</p>
      ) : null}

      {post.hero ? (
        <div className="mbs-10 relative aspect-[16/9] overflow-hidden bg-paper-alt">
          <Image
            src={storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, 'media', post.hero.path)}
            alt={post.hero.alt ?? ''}
            fill
            sizes="(min-width: 1180px) 1180px, 100vw"
            placeholder={post.hero.blur ? 'blur' : 'empty'}
            blurDataURL={post.hero.blur ?? undefined}
            className="object-cover"
            preload
          />
        </div>
      ) : null}

      <Prose className="mbs-10">
        <RichText doc={post.body} />
      </Prose>
    </article>
  );
}
