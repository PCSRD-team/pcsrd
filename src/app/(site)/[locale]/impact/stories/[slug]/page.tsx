import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContentBreadcrumbs, TranslationNotice } from '@/components/content/page-chrome';
import { RichText } from '@/components/content/rich-text';
import { getSiteName, toTranslationStatus } from '@/components/content/site';
import { StoryJsonLd } from '@/components/seo/json-ld';
import { DateText } from '@/components/ui/bidi';
import { Notice } from '@/components/ui/notice';
import { Container, PageHeader } from '@/components/ui/layout';
import { Meta, Prose } from '@/components/ui/typography';
import { getStoryBySlug, listStorySlugs } from '@/db/queries/content';
import { prerenderData } from '@/lib/build-time';
import { formatDate } from '@/lib/format';
import { isLocale, localePath } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export async function generateStaticParams() {
  const rows = await prerenderData('static params stories', () => listStorySlugs(), []);
  return rows.flatMap((row) => [
    { locale: 'ar', slug: row.slugAr },
    ...(row.translationStatus === 'ar_only' ? [] : [{ locale: 'en', slug: row.slugEn }]),
  ]);
}

export async function generateMetadata({ params }: PageProps<'/[locale]/impact/stories/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const [story, siteName] = await Promise.all([getStoryBySlug(slug, locale), getSiteName(locale)]);
  if (!story) return {};

  const seoTitle = locale === 'ar' ? story.seoTitleAr : story.seoTitleEn?.trim() || story.seoTitleAr;
  const seoDescription =
    locale === 'ar' ? story.seoDescriptionAr : story.seoDescriptionEn?.trim() || story.seoDescriptionAr;

  return buildMetadata({
    locale,
    path: { ar: `/impact/stories/${story.slugAr}`, en: `/impact/stories/${story.slugEn}` },
    title: seoTitle ?? story.title ?? siteName,
    description: seoDescription ?? story.summary,
    siteName,
    type: 'article',
    publishedTime: story.publishedAt,
    modifiedTime: story.updatedAt,
    translationStatus: toTranslationStatus(story.translationStatus),
    noIndex: story.noIndex,
  });
}

/**
 * One story, set as a single centred article at reading measure. The
 * pull-quote opens with the 2px gold rule and closes with the 1px rule —
 * an attestation, in the story's own words.
 */
export default async function StoryPage({ params }: PageProps<'/[locale]/impact/stories/[slug]'>) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, story] = await Promise.all([getDictionary(locale), getStoryBySlug(slug, locale)]);
  if (!story) notFound();

  return (
    <Container size="narrow" className="section-gap">
      <StoryJsonLd
        title={story.title}
        description={story.summary}
        url={localePath(locale, `/impact/stories/${slug}`)}
        locale={locale}
        publishedAt={story.publishedAt}
        updatedAt={story.updatedAt}
      />

      <TranslationNotice
        locale={locale}
        dict={dict}
        isTranslated={story.isTranslated}
        arabicPath={`/impact/stories/${story.slugAr}`}
      />

      <article>
        <PageHeader
          breadcrumbs={
            <ContentBreadcrumbs
              locale={locale}
              dict={dict}
              trail={[
                { label: dict.impact.title, path: '/impact' },
                { label: dict.impact.storiesTitle, path: '/impact' },
                { label: story.title ?? '' },
              ]}
            />
          }
          eyebrow={dict.impact.storiesTitle}
          title={story.title ?? ''}
          lede={story.summary}
          meta={
            story.publishedAt ? (
              <Meta as="p">
                <time dateTime={story.publishedAt.toISOString()}>
                  <DateText locale={locale}>{formatDate(story.publishedAt, locale)}</DateText>
                </time>
              </Meta>
            ) : null
          }
        />

        {/*
          The anonymisation notice is shown to the reader, not hidden as an
          internal flag. Saying plainly that a subject's identity was withheld is
          part of the story's credibility — and it explains the absence of a name
          or a photograph rather than leaving it looking like an omission.
        */}
        {story.subjectAnonymized ? (
          <Notice tone="info" live="off" className="mbe-8">
            {dict.impact.storyAnonymized}
          </Notice>
        ) : null}

        {story.quote ? (
          <blockquote className="mbe-10 border-be border-rule pbe-6">
            <div className="border-bs-2 border-gold-600 pbs-6">
              <p className="text-lead text-ink">{story.quote}</p>
              {story.quoteAttribution ? (
                <footer className="mbs-4">
                  <Meta as="p">— {story.quoteAttribution}</Meta>
                </footer>
              ) : null}
            </div>
          </blockquote>
        ) : null}

        <Prose measure="reading">
          <RichText doc={story.body} />
        </Prose>
      </article>
    </Container>
  );
}
