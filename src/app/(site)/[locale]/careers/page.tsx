import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { vacancyTypeLabel } from '@/components/content/cards';
import { ContentBreadcrumbs } from '@/components/content/page-chrome';
import { getSiteName } from '@/components/content/site';
import { CollectionPageJsonLd } from '@/components/seo/json-ld';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Container, PageHeader } from '@/components/ui/layout';
import { Table, TimeCell } from '@/components/ui/table';
import { listOpenVacancies } from '@/db/queries/content';
import { formatDate } from '@/lib/format';
import { isLocale, localePath } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/[locale]/careers'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [dict, siteName] = await Promise.all([getDictionary(locale), getSiteName(locale)]);
  return buildMetadata({
    locale,
    path: '/careers',
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
export default async function CareersPage({ params }: PageProps<'/[locale]/careers'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, vacancies] = await Promise.all([getDictionary(locale), listOpenVacancies(locale)]);

  return (
    <Container className="section-gap">
      <CollectionPageJsonLd
        name={dict.careers.title}
        description={dict.careers.lead}
        url={localePath(locale, '/careers')}
        locale={locale}
        items={vacancies.map((vacancy) => ({
          name: vacancy.title,
          url: localePath(locale, `/careers/${vacancy.slug}`),
        }))}
      />

      <PageHeader
        title={dict.careers.title}
        lede={dict.careers.lead}
        breadcrumbs={<ContentBreadcrumbs locale={locale} dict={dict} trail={[{ label: dict.careers.title }]} />}
      />

      <Table
        caption={dict.tableCaptions.openVacancies}
        rows={vacancies}
        rowHref={(vacancy) => localePath(locale, `/careers/${vacancy.slug}`)}
        // "No openings" is a real answer, not an error. The generic empty
        // state would leave an applicant wondering whether the page failed.
        empty={
          <EmptyState
            title={dict.careers.noOpenings}
            body={dict.states.emptyBody}
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
            numeric: true,
            align: 'start',
            cell: (vacancy) => vacancy.employmentType ?? '—',
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
    </Container>
  );
}
