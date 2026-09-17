import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { mediaSrc } from '@/components/content/media';
import { ContentBreadcrumbs } from '@/components/content/page-chrome';
import { getSiteName } from '@/components/content/site';
import { CollectionPageJsonLd } from '@/components/seo/json-ld';
import { Badge } from '@/components/ui/badge';
import { Bidi } from '@/components/ui/bidi';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Container, PageHeader } from '@/components/ui/layout';
import { Table } from '@/components/ui/table';
import { listPublications } from '@/db/queries/content';
import { formatFileSize } from '@/lib/format';
import { isLocale, localePath } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<'/[locale]/resources'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [dict, siteName] = await Promise.all([getDictionary(locale), getSiteName(locale)]);
  return buildMetadata({
    locale,
    path: '/resources',
    title: dict.resources.title,
    description: dict.resources.lead,
    siteName,
  });
}

/** The publications register: document, type, year, file. */
export default async function ResourcesPage({ params }: PageProps<'/[locale]/resources'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, publications] = await Promise.all([getDictionary(locale), listPublications(locale)]);

  return (
    <Container className="section-gap">
      {/* Items point at the list itself: a publication has no page of its
          own, and a `#fragment` URL is not a distinct resource. */}
      <CollectionPageJsonLd
        name={dict.resources.title}
        description={dict.resources.lead}
        url={localePath(locale, '/resources')}
        locale={locale}
        items={publications.map((publication) => ({
          name: publication.title,
          url: localePath(locale, '/resources'),
        }))}
      />

      <PageHeader
        title={dict.resources.title}
        lede={dict.resources.lead}
        breadcrumbs={<ContentBreadcrumbs locale={locale} dict={dict} trail={[{ label: dict.resources.title }]} />}
      />

      <Table
        caption={dict.tableCaptions.publications}
        rows={publications}
        empty={<EmptyState title={dict.states.emptyTitle} body={dict.states.emptyBody} bounded />}
        columns={[
          {
            key: 'title',
            header: dict.resources.title,
            rowHeader: true,
            cell: (publication) => (
              <span className="block">
                <span className="block text-body font-medium">{publication.title}</span>
                {publication.description ? (
                  <span className="measure mbs-1 block text-caption font-normal text-ink-55">
                    {publication.description}
                  </span>
                ) : null}
              </span>
            ),
          },
          {
            key: 'type',
            header: dict.forms.category,
            cell: (publication) => (
              <Badge tone="neutral" uppercase={false}>
                {dict.enums.publicationType[publication.type]}
              </Badge>
            ),
          },
          {
            key: 'year',
            header: dict.contentUi.year,
            numeric: true,
            align: 'start',
            cell: (publication) => (publication.publishedYear ? String(publication.publishedYear) : '—'),
          },
          {
            key: 'file',
            header: dict.contentUi.file,
            cell: (publication) =>
              publication.filePath ? (
                <ButtonLink
                  href={mediaSrc(publication.filePath, 'documents')}
                  tone="marked"
                  size="sm"
                  download
                  ariaLabel={`${dict.common.download}: ${publication.title ?? ''}`}
                >
                  {dict.common.download}{' '}
                  <Bidi className="font-mono text-eyebrow text-mono-muted">
                    {formatFileSize(publication.fileSize, locale)}
                  </Bidi>
                </ButtonLink>
              ) : (
                // A publication with no file in this locale is not an error —
                // the reader is told which language it exists in.
                <span className="text-caption text-ink-55">{dict.resources.notAvailableInLocale}</span>
              ),
          },
        ]}
      />
    </Container>
  );
}
