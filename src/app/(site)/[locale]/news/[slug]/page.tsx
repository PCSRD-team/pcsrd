import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { postCategoryLabel } from '@/components/content/cards';
import { mediaImage, mediaSrc } from '@/components/content/media';
import { ContentBreadcrumbs, TranslationNotice } from '@/components/content/page-chrome';
import { RichText } from '@/components/content/rich-text';
import { getSiteName, toTranslationStatus } from '@/components/content/site';
import { ArticleJsonLd } from '@/components/seo/json-ld';
import { DateText } from '@/components/ui/bidi';
import { Figure } from '@/components/ui/figure';
import { Container, Grid, PageHeader, Section, SectionHeading } from '@/components/ui/layout';
import { Meta, Prose } from '@/components/ui/typography';
import { findSlugForLocale, getPostBySlug, listPostSlugs } from '@/db/queries/content';
import { prerenderData } from '@/lib/build-time';
import { formatDate, timeOf, toDateTimeAttr } from '@/lib/format';
import { DEFAULT_LOCALE, isLocale, localePath } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { richTextToPlainText } from '@/lib/seo/json-ld';
import { buildMetadata, seoFallback } from '@/lib/seo/metadata';
import { decodeParam } from '@/lib/route-params';
import { ButtonLink } from '@/components/ui/button';
import styles from '../news.module.css';

export const revalidate = 3600;

export async function generateStaticParams() {
  const rows = await prerenderData('static params posts', () => listPostSlugs(), []);
  return rows.flatMap((row) => [
    { locale: 'ar', slug: row.slugAr },
    ...(row.translationStatus === 'ar_only' ? [] : [{ locale: 'en', slug: row.slugEn }]),
  ]);
}

export async function generateMetadata({ params }: PageProps<'/[locale]/news/[slug]'>): Promise<Metadata> {
  const { locale, slug: rawSlug } = await params;
  const slug = decodeParam(rawSlug);
  if (!isLocale(locale)) return {};
  const [post, siteName, dict] = await Promise.all([
    getPostBySlug(slug, locale),
    getSiteName(locale),
    getDictionary(locale),
  ]);
  if (!post) return {};

  // SEO-013: the English SEO title is read on English pages, falling back to Arabic.
  const seoTitle = locale === 'ar' ? post.seoTitleAr : post.seoTitleEn?.trim() || post.seoTitleAr;
  const seoDescription =
    locale === 'ar' ? post.seoDescriptionAr : post.seoDescriptionEn?.trim() || post.seoDescriptionAr;

  return buildMetadata({
    locale,
    path: { ar: `/news/${post.slugAr}`, en: `/news/${post.slugEn}` },
    title: seoFallback(seoTitle, post.title, siteName),
    // The body, then the section's own lead, so a post with no excerpt — or
    // no text at all — still ships a description rather than none.
    description: seoFallback(
      seoDescription,
      post.excerpt,
      richTextToPlainText(post.body, 160),
      dict.news.lead,
    ),
    siteName,
    type: 'article',
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
    translationStatus: toTranslationStatus(post.translationStatus),
    noIndex: post.noIndex,
    ownCard: true,
  });
}

export default async function PostPage({ params }: PageProps<'/[locale]/news/[slug]'>) {
  const { locale, slug: rawSlug } = await params;
  const slug = decodeParam(rawSlug);
  if (!isLocale(locale)) notFound();

  const [dict, post] = await Promise.all([getDictionary(locale), getPostBySlug(slug, locale)]);
  if (!post) {
    // The language switcher keeps the slug and swaps the prefix; redirect a
    // slug from the other locale to this locale's URL instead of a 404.
    const localized = await findSlugForLocale('post', slug, locale);
    if (localized) permanentRedirect(localePath(locale, `/news/${encodeURIComponent(localized)}`));
    notFound();
  }

  // An untranslated post's canonical is the Arabic URL and its text is
  // Arabic; the structured data must not claim an English article.
  const canonicalPath = post.isTranslated
    ? localePath(locale, `/news/${slug}`)
    : localePath(DEFAULT_LOCALE, `/news/${post.slugAr}`);
  const contentLocale = post.isTranslated ? locale : DEFAULT_LOCALE;

  const hero = mediaImage(post.hero?.path, post.hero?.blur, post.hero);
  const showUpdated =
    (timeOf(post.updatedAt) ?? 0) - (timeOf(post.publishedAt) ?? 0) > 24 * 60 * 60 * 1000;

  return (
    <Container className={`${styles.page} ${styles.detail}`}>
      <ArticleJsonLd
        title={post.title}
        description={post.excerpt}
        url={canonicalPath}
        locale={contentLocale}
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
        <div className={`${styles.articleIntro} ${hero ? styles.withImage : ''}`}>
        <PageHeader
          className={styles.articleHeader}
          breadcrumbs={
            <ContentBreadcrumbs
              locale={locale}
              dict={dict}
              trail={[{ label: dict.news.title, path: '/news' }, { label: post.title ?? '' }]}
              currentPath={canonicalPath}
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
                  <time dateTime={toDateTimeAttr(post.publishedAt)}>
                    <DateText locale={locale}>{formatDate(post.publishedAt, locale)}</DateText>
                  </time>
                </Meta>
              ) : null}
              {showUpdated ? (
                <Meta as="p">
                  {dict.contentUi.updatedOn}{' '}
                  <time dateTime={toDateTimeAttr(post.updatedAt)}>
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
            // The asset's own alt; failing that, the headline the image
            // illustrates — never an empty alt on the article's lead image.
            alt={post.hero?.alt || post.title || ''}
            decorative={!(post.hero?.alt || post.title)}
            // Match the full content width and its responsive side gutters.
            sizes="(min-width: 1180px) 494px, (min-width: 1024px) 43vw, (min-width: 768px) calc(100vw - 128px), calc(100vw - 40px)"
            // The article's hero, and the only `preload` on this route.
            preload
            className={styles.articleImage}
          />
        ) : null}
        </div>

        <div className={styles.articleBody}>
        <Prose measure="reading">
          <RichText doc={post.body} />
        </Prose>
        </div>
        {post.gallery.length > 0 ? (
          <Section labelledBy="post-gallery" bounded={false} spacing="none" className={styles.gallery}>
            <SectionHeading id="post-gallery" title={dict.contentUi.gallery} />
            <Grid as="ul" cols={3} gap={4}>
              {post.gallery.map((item) => (
                <li key={item.path}>
                  {/* `alt` is the media asset's own — `alt_ar` is NOT NULL in
                      the schema, so a published image always has one. */}
                  <Figure
                    image={mediaImage(item.path, item.blur, item)}
                    alt={item.alt || post.title || ''}
                    ratio="portrait"
                    // Three columns on desktop, one on small screens.
                    sizes="(min-width: 1180px) 310px, (min-width: 768px) 28vw, calc(100vw - 80px)"
                    caption={item.caption}
                  />
                </li>
              ))}
            </Grid>
          </Section>
        ) : null}
        <div className={styles.backLink}>
          <ButtonLink href={localePath(locale, '/news')} tone="secondary">{dict.news.title}</ButtonLink>
        </div>
      </article>
    </Container>
  );
}
