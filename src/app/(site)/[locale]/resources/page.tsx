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
import { Icon } from '@/components/ui/icon';
import { Pagination } from '@/components/ui/pagination';
import styles from './resources.module.css';
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
export default async function ResourcesPage({ params, searchParams }: PageProps<'/[locale]/resources'>) {
  const [{ locale }, search] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const [dict, publications] = await Promise.all([getDictionary(locale), listPublications(locale)]);
  const rawPage = Array.isArray(search.page) ? search.page[0] : search.page;
  const requestedPage = Number(rawPage);
  const pageSize = 9;
  const totalPages = Math.max(1, Math.ceil(publications.length / pageSize));
  const page = Math.min(totalPages, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
  const visiblePublications = publications.slice((page - 1) * pageSize, page * pageSize);
  const pageHref = (target: number) => localePath(locale, `/resources${target > 1 ? `?page=${target}` : ''}`);

  return (
    <Container className={styles.page}>
      {/* Items point at the list itself: a publication has no page of its
          own, and a `#fragment` URL is not a distinct resource. */}
      <CollectionPageJsonLd
        name={dict.resources.title}
        description={dict.resources.lead}
        url={pageHref(page)}
        locale={locale}
        items={visiblePublications.map((publication) => ({
          name: publication.title,
          url: localePath(locale, '/resources'),
        }))}
      />

      <PageHeader className={styles.hero}
        title={dict.resources.title}
        lede={dict.resources.lead}
        breadcrumbs={<ContentBreadcrumbs locale={locale} dict={dict} trail={[{ label: dict.resources.title }]} currentPath="/resources" />}
      />

      <section aria-labelledby="publications-list">
        <h2 id="publications-list" className={styles.listTitle}>{dict.tableCaptions.publications}</h2>
        {publications.length === 0 ? (
          <EmptyState title={dict.states.emptyTitle} body={dict.states.emptyBody} bounded />
        ) : (
          <ul className={styles.list}>
            {visiblePublications.map((publication) => (
              <li key={publication.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.icon} aria-hidden="true"><Icon name="download" size={24} /></span>
                  <Badge tone="neutral" uppercase={false}>{dict.enums.publicationType[publication.type]}</Badge>
                </div>
                <h3>{publication.title}</h3>
                {publication.description ? <p className={styles.description}>{publication.description}</p> : null}
                <dl className={styles.meta}>
                  <div><dt>{dict.contentUi.year}</dt><dd><Bidi>{publication.publishedYear ? String(publication.publishedYear) : '—'}</Bidi></dd></div>
                  {publication.filePath ? <div><dt>{dict.contentUi.file}</dt><dd><Bidi>{formatFileSize(publication.fileSize, locale)}</Bidi></dd></div> : null}
                </dl>
                <div className={styles.cardFooter}>
                  {publication.filePath ? (
                    <ButtonLink href={mediaSrc(publication.filePath, 'documents')} tone="primary" size="sm" download ariaLabel={`${dict.common.download}: ${publication.title ?? ''}`}>
                      <Icon name="download" size={16} />{dict.common.download}
                    </ButtonLink>
                  ) : (
                    <span className="text-caption text-ink-55">{dict.resources.notAvailableInLocale}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Pagination page={page} totalPages={totalPages} hrefFor={pageHref}
        label={dict.a11y.pagination} previousLabel={dict.common.previous} nextLabel={dict.common.next}
        pageLabel={(target) => `${dict.common.page} ${target}`} className={styles.pagination} />
    </Container>
  );
}
