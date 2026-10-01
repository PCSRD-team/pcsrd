import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { vacancyTypeLabel } from '@/components/content/cards';
import { ContentBreadcrumbs, employmentTypeLabel } from '@/components/content/page-chrome';
import { getSiteName } from '@/components/content/site';
import { CollectionPageJsonLd } from '@/components/seo/json-ld';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Container, PageHeader, Section, SectionHeading } from '@/components/ui/layout';
import { Tabs } from '@/components/ui/tabs';
import { Table, TimeCell } from '@/components/ui/table';
import { listOpenForms } from '@/db/queries/applications';
import { listOpenVacancies } from '@/db/queries/content';
import { vacancyType, type VacancyType } from '@/db/schema/enums';
import { formatDate, formatInstant, toDateTimeAttr } from '@/lib/format';
import { isLocale, localePath, type Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 300;

type SearchParams = Record<string, string | string[] | undefined>;

/** `?type=` is user input; anything unknown falls back to "all". */
function readType(search: SearchParams): VacancyType | undefined {
  const raw = Array.isArray(search.type) ? search.type[0] : search.type;
  return (vacancyType.enumValues as readonly string[]).includes(raw ?? '')
    ? (raw as VacancyType)
    : undefined;
}

function listHref(locale: Locale, type: VacancyType | undefined): string {
  return localePath(locale, `/careers${type ? `?type=${type}` : ''}`);
}

export async function generateMetadata({ params, searchParams }: PageProps<'/[locale]/careers'>): Promise<Metadata> {
  const [{ locale }, search] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) return {};
  const type = readType(search);
  const [dict, siteName] = await Promise.all([getDictionary(locale), getSiteName(locale)]);
  return buildMetadata({
    locale,
    // The filtered view is its own URL, so it canonicalises to itself rather
    // than competing with the unfiltered list for the same one.
    path: type ? `/careers?type=${type}` : '/careers',
    title: dict.careers.title,
    description: dict.careers.lead,
    siteName,
  });
}

/**
 * Open positions as a ruled register: title and location, type, deadline.
 * A table because that is what it is — four attributes per row, compared
 * down the columns — and the kit's `Table` gives it a caption, row headers
 * and LTR date cells for free.
 */
export default async function CareersPage({ params, searchParams }: PageProps<'/[locale]/careers'>) {
  const [{ locale }, search] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const type = readType(search);
  const [dict, vacancies, openForms] = await Promise.all([
    getDictionary(locale),
    listOpenVacancies(locale, { type }),
    listOpenForms(locale),
  ]);

  // Portal forms that no vacancy links to — a volunteer intake, a training
  // cohort. A form behind a vacancy is reached from that vacancy's page, and
  // listing it here as well would show the same opportunity twice. Without
  // this section a standalone form was reachable only by its direct link.
  const standaloneForms = openForms
    .filter((form) => form.vacancyId === null)
    // The kit's `Table` keys rows by `id`; a form's slug is unique.
    .map((form) => ({ ...form, id: form.slug }));

  // Links, not buttons, so the filter is the URL: crawlable, shareable, and
  // working with scripting off. `listOpenVacancies` has accepted `type` since
  // it was written and nothing passed it.
  const tabs = [
    { label: dict.filters.all, href: listHref(locale, undefined), current: !type },
    ...vacancyType.enumValues.map((value) => ({
      label: vacancyTypeLabel(value, dict),
      href: listHref(locale, value),
      current: type === value,
    })),
  ];

  return (
    <Container className="section-gap">
      <CollectionPageJsonLd
        name={dict.careers.title}
        description={dict.careers.lead}
        url={listHref(locale, type)}
        locale={locale}
        items={vacancies.map((vacancy) => ({
          name: vacancy.title,
          url: localePath(locale, `/careers/${vacancy.slug}`),
        }))}
      />

      <PageHeader
        title={dict.careers.title}
        lede={dict.careers.lead}
        breadcrumbs={
          <ContentBreadcrumbs
            locale={locale}
            dict={dict}
            trail={[{ label: dict.careers.title }]}
            currentPath={listHref(locale, type)}
          />
        }
      />

      <Tabs items={tabs} label={dict.contentUi.vacancyType} className="mbe-8" />

      <Table
        caption={dict.tableCaptions.openVacancies}
        rows={vacancies}
        rowHref={(vacancy) => localePath(locale, `/careers/${vacancy.slug}`)}
        // "No openings" is a real answer, not an error. The generic empty
        // state would leave an applicant wondering whether the page failed.
        // It must not contradict the page either: "content will appear here
        // once published" above a list of open opportunities read as broken,
        // and a filtered view that is empty is a filter result, not a verdict.
        empty={
          <EmptyState
            title={dict.careers.noOpenings}
            body={
              type
                ? dict.states.emptyFiltered
                : standaloneForms.length > 0
                  ? dict.careers.noVacanciesSeeForms
                  : dict.states.emptyBody
            }
            bounded
            action={
              <ButtonLink href={localePath(locale, '/get-involved/volunteer')} tone="secondary" size="sm">
                {dict.contentUi.vacancyVolunteer}
              </ButtonLink>
            }
          />
        }
        columns={[
          {
            key: 'title',
            header: dict.forms.role,
            rowHeader: true,
            cell: (vacancy) => (
              <span className="block">
                <span className="block text-body font-medium">{vacancy.title}</span>
                {vacancy.location ? (
                  <span className="mbs-1 block text-caption text-ink-55">{vacancy.location}</span>
                ) : null}
              </span>
            ),
          },
          {
            key: 'type',
            header: dict.contentUi.vacancyType,
            cell: (vacancy) => (
              <Badge tone={vacancy.type === 'volunteer' ? 'info' : 'neutral'} uppercase={false}>
                {vacancyTypeLabel(vacancy.type, dict)}
              </Badge>
            ),
          },
          {
            key: 'employmentType',
            header: dict.careers.employmentType,
            // A label, not a figure: no tabular numerals, no LTR cell.
            align: 'start',
            cell: (vacancy) => employmentTypeLabel(vacancy.employmentType, dict) ?? '—',
          },
          {
            key: 'deadline',
            header: dict.careers.deadline,
            numeric: true,
            align: 'start',
            cell: (vacancy) => (
              <TimeCell dateTime={vacancy.deadline} locale={locale}>{formatDate(vacancy.deadline, locale)}</TimeCell>
            ),
          },
        ]}
      />

      {standaloneForms.length > 0 ? (
        <Section labelledBy="careers-open-forms" className="mbs-12">
          <SectionHeading id="careers-open-forms" title={dict.careers.openForms} />
          <p className="mbe-6 max-w-prose text-body text-ink-70">{dict.careers.openFormsLead}</p>
          <Table
            caption={dict.careers.openForms}
            rows={standaloneForms}
            rowHref={(form) => localePath(locale, `/apply/${form.slug}`)}
            // Unreachable: the section renders only when there is a row.
            empty={null}
            columns={[
              {
                key: 'title',
                header: dict.careers.opportunity,
                rowHeader: true,
                cell: (form) => <span className="block text-body font-medium">{form.title}</span>,
              },
              {
                key: 'kind',
                header: dict.careers.opportunityKind,
                cell: (form) => (
                  <Badge tone="neutral" uppercase={false}>
                    {dict.apply.kind[form.kind]}
                  </Badge>
                ),
              },
              {
                key: 'closesAt',
                header: dict.careers.deadline,
                numeric: true,
                align: 'start',
                cell: (form) =>
                  form.closesAt ? (
                    // An instant, on the Palestine clock: `formatDate` pins UTC
                    // and showed a late-evening deadline a day early.
                    <TimeCell dateTime={toDateTimeAttr(form.closesAt) ?? ''} locale={locale}>
                      {formatInstant(form.closesAt, locale)} {dict.apply.siteTimeZone}
                    </TimeCell>
                  ) : (
                    dict.careers.noDeadline
                  ),
              },
            ]}
          />
        </Section>
      ) : null}
    </Container>
  );
}
