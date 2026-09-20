import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { vacancyTypeLabel } from '@/components/content/cards';
import { ContentBreadcrumbs, TranslationNotice } from '@/components/content/page-chrome';
import { RichText } from '@/components/content/rich-text';
import { getSiteName, toTranslationStatus } from '@/components/content/site';
import { JobApplicationForm } from '@/components/forms/public-forms';
import { JobPostingJsonLd } from '@/components/seo/json-ld';
import { Badge } from '@/components/ui/badge';
import { Bidi, DateText } from '@/components/ui/bidi';
import { ButtonLink } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { DefinitionList } from '@/components/ui/definition-list';
import { Notice } from '@/components/ui/notice';
import { Container, PageHeader, Section, SectionHeading } from '@/components/ui/layout';
import { Eyebrow, Prose } from '@/components/ui/typography';
import { getOrganization, getVacancyBySlug, listVacancySlugs } from '@/db/queries/content';
import { prerenderData } from '@/lib/build-time';
import { formatDate } from '@/lib/format';
import { isLocale, localePath } from '@/lib/i18n/config';
import { formSlice } from '@/lib/i18n/form-dict';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { richTextToPlainText } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 300;

export async function generateStaticParams() {
  const rows = await prerenderData('static params vacancies', () => listVacancySlugs(), []);
  return rows.flatMap((row) => [
    { locale: 'ar', slug: row.slugAr },
    ...(row.translationStatus === 'ar_only' ? [] : [{ locale: 'en', slug: row.slugEn }]),
  ]);
}

export async function generateMetadata({ params }: PageProps<'/[locale]/careers/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const [vacancy, siteName] = await Promise.all([getVacancyBySlug(slug, locale), getSiteName(locale)]);
  if (!vacancy) return {};

  const seoTitle = locale === 'ar' ? vacancy.seoTitleAr : vacancy.seoTitleEn?.trim() || vacancy.seoTitleAr;
  const seoDescription =
    locale === 'ar' ? vacancy.seoDescriptionAr : vacancy.seoDescriptionEn?.trim() || vacancy.seoDescriptionAr;

  return buildMetadata({
    locale,
    path: { ar: `/careers/${vacancy.slugAr}`, en: `/careers/${vacancy.slugEn}` },
    title: seoTitle?.trim() || vacancy.title?.trim() || siteName,
    description: seoDescription ?? richTextToPlainText(vacancy.description, 160),
    siteName,
    translationStatus: toTranslationStatus(vacancy.translationStatus),
    // A closed vacancy stays reachable — an applicant following an old link
    // deserves to be told it closed — but it leaves the index.
    noIndex: vacancy.noIndex || vacancy.isClosed,
  });
}

export default async function VacancyPage({ params }: PageProps<'/[locale]/careers/[slug]'>) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, vacancy, org] = await Promise.all([
    getDictionary(locale),
    getVacancyBySlug(slug, locale),
    getOrganization(locale),
  ]);
  if (!vacancy) notFound();

  const url = localePath(locale, `/careers/${slug}`);

  return (
    <Container className="section-gap">
      {/* SEO-015: the description is the posting's own text, never the
          location; `org` attributes the posting by name and logo. */}
      <JobPostingJsonLd
        title={vacancy.title}
        description={richTextToPlainText(vacancy.description)}
        url={url}
        locale={locale}
        deadline={vacancy.deadline}
        postedAt={vacancy.postedAt}
        employmentType={vacancy.employmentType}
        location={vacancy.location}
        org={org}
        volunteer={vacancy.type === 'volunteer'}
      />

      <TranslationNotice
        locale={locale}
        dict={dict}
        isTranslated={vacancy.isTranslated}
        arabicPath={`/careers/${vacancy.slugAr}`}
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
        <div className="min-w-0">
          <PageHeader
            breadcrumbs={
              <ContentBreadcrumbs
                locale={locale}
                dict={dict}
                trail={[{ label: dict.careers.title, path: '/careers' }, { label: vacancy.title ?? '' }]}
              />
            }
            eyebrow={vacancyTypeLabel(vacancy.type, dict)}
            title={vacancy.title ?? ''}
            meta={
              vacancy.isClosed ? (
                <Badge tone="warning" dot>
                  {dict.careers.closed}
                </Badge>
              ) : (
                <Badge tone="active" dot>
                  {dict.careers.deadline}:{' '}
                  <DateText locale={locale}>{formatDate(vacancy.deadline, locale)}</DateText>
                </Badge>
              )
            }
          />

          {vacancy.isClosed ? (
            <Notice
              tone="warning"
              live="off"
              title={dict.careers.closed}
              className="mbe-8"
              actions={
                <ButtonLink href={localePath(locale, '/careers')} tone="secondary" size="sm">
                  {dict.contentUi.backToCareers}
                </ButtonLink>
              }
            >
              {dict.contentUi.closedNotice}
            </Notice>
          ) : null}

          {vacancy.description ? (
            <Section labelledBy="vacancy-description">
              <SectionHeading id="vacancy-description" title={dict.forms.description} />
              <Prose>
                <RichText doc={vacancy.description} />
              </Prose>
            </Section>
          ) : null}

          {vacancy.requirements ? (
            <Section labelledBy="vacancy-requirements">
              <SectionHeading id="vacancy-requirements" title={dict.careers.requirements} />
              <Prose>
                <RichText doc={vacancy.requirements} />
              </Prose>
            </Section>
          ) : null}

          {/* No form on a closed vacancy. Letting someone spend twenty minutes
              on an application for a closed position is the failure the
              deadline column exists to prevent. */}
          {vacancy.isClosed ? null : (
            <Section labelledBy="vacancy-apply">
              <SectionHeading id="vacancy-apply" title={dict.careers.applyNow} />
              {vacancy.applicationMethod === 'email' && vacancy.applicationEmail ? (
                <Panel>
                  <p className="text-small text-ink">
                    {dict.careers.applyByEmail}:{' '}
                    <a href={`mailto:${vacancy.applicationEmail}`}>
                      <Bidi>{vacancy.applicationEmail}</Bidi>
                    </a>
                  </p>
                </Panel>
              ) : (
                <div className="max-w-narrow">
                  <JobApplicationForm dict={formSlice(dict)} locale={locale} vacancyId={vacancy.id} />
                </div>
              )}
            </Section>
          )}
        </div>

        {/* The record opens with the 2px rule: deadline, contract type,
            location, posted date — the four facts an applicant checks first. */}
        <aside aria-labelledby="vacancy-record" className="rule-section pbs-5 lg:sticky lg:inset-bs-6 lg:self-start">
          <Eyebrow id="vacancy-record" as="p">
            {dict.contentUi.viewVacancy}
          </Eyebrow>
          <DefinitionList
            layout="ruled"
            labelledBy="vacancy-record"
            className="mbs-3"
            items={[
              {
                term: dict.careers.deadline,
                value: (
                  <time dateTime={vacancy.deadline}>
                    <DateText locale={locale}>{formatDate(vacancy.deadline, locale)}</DateText>
                  </time>
                ),
              },
              { term: dict.contentUi.vacancyType, value: vacancyTypeLabel(vacancy.type, dict) },
              {
                term: dict.careers.employmentType,
                value: vacancy.employmentType ? <Bidi>{vacancy.employmentType}</Bidi> : null,
              },
              { term: dict.careers.location, value: vacancy.location },
              {
                term: dict.careers.postedOn,
                value: (
                  <time dateTime={vacancy.postedAt}>
                    <DateText locale={locale}>{formatDate(vacancy.postedAt, locale)}</DateText>
                  </time>
                ),
              },
            ]}
          />
        </aside>
      </div>
    </Container>
  );
}
