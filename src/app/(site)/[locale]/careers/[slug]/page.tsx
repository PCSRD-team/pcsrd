import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RichText } from '@/components/content/rich-text';
import { JobApplicationForm } from '@/components/forms/public-forms';
import { JobPostingJsonLd } from '@/components/seo/json-ld';
import { Bidi } from '@/components/ui/bidi';
import { Badge, DefinitionList, Panel, Prose, Section, SectionHeading } from '@/components/ui/primitives';
import { UntranslatedNotice } from '@/components/ui/states';
import { getVacancyBySlug } from '@/db/queries/content';
import { formatDate } from '@/lib/format';
import { isLocale } from '@/lib/i18n/config';
import { formSlice } from '@/lib/i18n/form-dict';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/careers/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const vacancy = await getVacancyBySlug(slug, locale);
  if (!vacancy) return {};

  return {
    title: vacancy.title ?? undefined,
    // A closed vacancy stays reachable — an applicant following an old link
    // deserves to be told it closed — but it leaves the index.
    robots: vacancy.isClosed || vacancy.noIndex ? { index: false, follow: true } : undefined,
    alternates: {
      canonical: `/${locale}/careers/${slug}`,
      languages: { ar: `/ar/careers/${vacancy.slugAr}`, en: `/en/careers/${vacancy.slugEn}` },
    },
  };
}

export default async function VacancyPage({ params }: PageProps<'/[locale]/careers/[slug]'>) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, vacancy] = await Promise.all([
    getDictionary(locale),
    getVacancyBySlug(slug, locale),
  ]);
  if (!vacancy) notFound();

  return (
    <div className="container-content section-gap">
      <JobPostingJsonLd
        title={vacancy.title}
        description={vacancy.location}
        deadline={vacancy.deadline}
        postedAt={vacancy.postedAt}
        employmentType={vacancy.employmentType}
        location={vacancy.location}
        locale={locale}
      />

      {!vacancy.isTranslated ? (
        <UntranslatedNotice
          title={dict.states.untranslatedTitle}
          body={dict.states.untranslatedBody}
        />
      ) : null}

      <h1 className="text-h1 font-semibold text-ink">{vacancy.title}</h1>
      <span className="rule-mark mbs-5 block" aria-hidden="true" />

      <Panel className="mbs-8">
        <DefinitionList
          items={[
            { term: dict.careers.location, value: vacancy.location },
            { term: dict.careers.employmentType, value: vacancy.employmentType },
            {
              term: dict.careers.deadline,
              value: (
                <span className="flex flex-wrap items-center gap-3">
                  <Bidi>{formatDate(vacancy.deadline, locale)}</Bidi>
                  {vacancy.isClosed ? <Badge tone="warning">{dict.careers.closed}</Badge> : null}
                </span>
              ),
            },
            {
              term: dict.careers.postedOn,
              value: <Bidi>{formatDate(vacancy.postedAt, locale)}</Bidi>,
            },
          ]}
        />
      </Panel>

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

      <Section labelledBy="vacancy-apply">
        <SectionHeading id="vacancy-apply" title={dict.careers.applyNow} />

        {vacancy.isClosed ? (
          // No form. Letting someone spend twenty minutes on an application for
          // a closed position is the failure the deadline column exists to
          // prevent.
          <Panel tone="alt">
            <p className="text-small text-ink">{dict.careers.closed}</p>
          </Panel>
        ) : vacancy.applicationMethod === 'email' && vacancy.applicationEmail ? (
          <Panel>
            <p className="text-small text-ink">
              {dict.careers.applyByEmail}:{' '}
              <a href={`mailto:${vacancy.applicationEmail}`}>
                <Bidi>{vacancy.applicationEmail}</Bidi>
              </a>
            </p>
          </Panel>
        ) : (
          <div className="max-w-[52rem]">
            <JobApplicationForm dict={formSlice(dict)} locale={locale} vacancyId={vacancy.id} />
          </div>
        )}
      </Section>
    </div>
  );
}
