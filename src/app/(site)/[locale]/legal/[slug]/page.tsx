import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RichText } from '@/components/content/rich-text';
import { organizationName } from '@/components/layout/chrome';
import { SiteBreadcrumbs } from '@/components/layout/site-breadcrumbs';
import { DateText } from '@/components/ui/bidi';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState, UntranslatedNotice } from '@/components/ui/feedback';
import { Container, PageHeader, Rule } from '@/components/ui/layout';
import { Eyebrow, Meta, Prose } from '@/components/ui/typography';
import { getOrganization, getPageByKey } from '@/db/queries/content';
import { formatDate } from '@/lib/format';
import { DEFAULT_LOCALE, isLocale, localePath, type Locale } from '@/lib/i18n/config';
import { getDictionary, type Dictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata, type TranslationStatus } from '@/lib/seo/metadata';

export const revalidate = 3600;

/**
 * Legal and policy pages. `key` is the stable identifier the route looks up by;
 * the slug is only what the URL shows, so the organisation can rename a page in
 * either language without breaking this route.
 *
 * A known key whose page is not published (or has no body yet) renders the
 * designed empty state under its own title, so the footer link never lands on
 * a bare 404. An unknown key is a 404.
 */
const KEYS = ['privacy', 'accessibility', 'terms'] as const;
type LegalKey = (typeof KEYS)[number];

function isLegalKey(value: string): value is LegalKey {
  return (KEYS as readonly string[]).includes(value);
}

function legalTitle(dict: Dictionary, key: LegalKey): string {
  return { privacy: dict.footer.privacy, accessibility: dict.footer.accessibility, terms: dict.footer.terms }[key];
}

/** The schema's enum has one more value than the builder's type; `reviewed` is a human translation. */
function toTranslationStatus(value: string): TranslationStatus {
  return value === 'ar_only' || value === 'machine_draft' ? value : 'human_translated';
}

function hasBody(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const content = (body as { content?: unknown[] }).content;
  return Array.isArray(content) && content.length > 0;
}

export function generateStaticParams() {
  return KEYS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<'/[locale]/legal/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isLegalKey(slug)) return {};
  const [dict, org, page] = await Promise.all([
    getDictionary(locale),
    getOrganization(locale),
    getPageByKey(slug, locale),
  ]);
  const seoTitle = locale === 'ar' ? page?.seoTitleAr : page?.seoTitleEn?.trim() || page?.seoTitleAr;
  const seoDescription =
    locale === 'ar' ? page?.seoDescriptionAr : page?.seoDescriptionEn?.trim() || page?.seoDescriptionAr;

  return buildMetadata({
    locale,
    path: `/legal/${slug}`,
    title: seoTitle ?? page?.title ?? legalTitle(dict, slug),
    description: seoDescription,
    siteName: organizationName(org),
    translationStatus: page ? toTranslationStatus(page.translationStatus) : null,
    noIndex: page?.noIndex ?? false,
  });
}

function LegalNav({ locale, dict, current }: { locale: Locale; dict: Dictionary; current: LegalKey }) {
  return (
    <nav aria-label={dict.footer.legalTitle}>
      <Eyebrow as="p" className="mbe-3">
        {dict.legalPages.eyebrow}
      </Eyebrow>
      <Rule weight="section" as="div" />
      <ul>
        {KEYS.map((key) => (
          <li key={key} className="border-be border-rule">
            <Link
              href={localePath(locale, `/legal/${key}`)}
              aria-current={key === current ? 'page' : undefined}
              className={
                key === current
                  ? 'flex min-h-target items-center border-s-2 border-s-gold-600 ps-3 text-small font-medium text-ink no-underline'
                  : 'flex min-h-target items-center ps-3 text-small text-ink-70 no-underline hover:text-gold-700'
              }
            >
              {legalTitle(dict, key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default async function LegalPage({ params }: PageProps<'/[locale]/legal/[slug]'>) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isLegalKey(slug)) notFound();

  const [dict, page] = await Promise.all([getDictionary(locale), getPageByKey(slug, locale)]);
  const title = page?.title ?? legalTitle(dict, slug);
  const published = Boolean(page && hasBody(page.body));
  const updatedAt = page?.updatedAt ?? null;

  return (
    <Container className="section-gap">
      <PageHeader
        eyebrow={dict.legalPages.eyebrow}
        title={title}
        breadcrumbs={
          <SiteBreadcrumbs
            locale={locale}
            dict={dict}
            trail={[{ label: legalTitle(dict, slug), path: `/legal/${slug}` }]}
          />
        }
        meta={
          published && updatedAt ? (
            <Meta>
              {dict.legalPages.lastUpdated}{' '}
              <time dateTime={updatedAt.toISOString()}>
                <DateText locale={locale}>{formatDate(updatedAt, locale)}</DateText>
              </time>
            </Meta>
          ) : null
        }
      />

      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        <div className="lg:sticky lg:inset-bs-28 lg:self-start">
          <LegalNav locale={locale} dict={dict} current={slug} />
        </div>

        {published && page ? (
          <article>
            {!page.isTranslated ? (
              <UntranslatedNotice
                title={dict.states.untranslatedTitle}
                body={dict.states.untranslatedBody}
                action={
                  locale !== DEFAULT_LOCALE ? (
                    <ButtonLink href={localePath(DEFAULT_LOCALE, `/legal/${slug}`)} tone="secondary" size="sm">
                      {dict.legalPages.readArabic}
                    </ButtonLink>
                  ) : null
                }
              />
            ) : null}
            {/* An untranslated body is the Arabic original: mark it so it is read in the right voice. */}
            <div lang={page.isTranslated ? undefined : 'ar'} dir={page.isTranslated ? undefined : 'rtl'}>
              <Prose measure="reading">
                <RichText doc={page.body} />
              </Prose>
            </div>
          </article>
        ) : (
          <EmptyState
            bounded
            title={dict.legalPages.unpublishedTitle}
            body={dict.legalPages.unpublishedBody}
            action={
              <ButtonLink href={localePath(locale, '/contact')} tone="secondary">
                {dict.nav.contact}
              </ButtonLink>
            }
          />
        )}
      </div>
    </Container>
  );
}
