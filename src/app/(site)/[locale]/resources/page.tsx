import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Bidi } from '@/components/ui/bidi';
import { Panel, SectionHeading } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { listPublications } from '@/db/queries/content';
import { publicEnv } from '@/lib/env.public';
import { formatFileSize, storageUrl } from '@/lib/format';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<'/[locale]/resources'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    title: dict.resources.title,
    description: dict.resources.lead,
    alternates: { canonical: `/${locale}/resources`, languages: { ar: '/ar/resources', en: '/en/resources' } },
  };
}

export default async function ResourcesPage({ params }: PageProps<'/[locale]/resources'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, publications] = await Promise.all([
    getDictionary(locale),
    listPublications(locale),
  ]);

  return (
    <div className="container-content section-gap">
      <SectionHeading as="h1" title={dict.resources.title} lead={dict.resources.lead} />

      {publications.length === 0 ? (
        <EmptyState title={dict.states.emptyTitle} body={dict.states.emptyBody} />
      ) : (
        <ul className="space-y-4">
          {publications.map((publication) => (
            <Panel as="li" key={publication.id} className="flex flex-wrap items-baseline justify-between gap-4">
              <div className="min-w-0">
                <p className="eyebrow">{dict.enums.publicationType[publication.type]}</p>
                <h2 className="mbs-2 text-h3 font-semibold text-ink">{publication.title}</h2>
                {publication.description ? (
                  <p className="measure mbs-2 text-small text-ink-70">{publication.description}</p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-baseline gap-4">
                {publication.publishedYear ? (
                  <span className="font-mono text-caption text-mono-muted">
                    <Bidi>{String(publication.publishedYear)}</Bidi>
                  </span>
                ) : null}
                {publication.filePath ? (
                  <a
                    href={storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, 'documents', publication.filePath)}
                    className="border-be-2 border-gold-600 py-1 text-small font-medium text-ink no-underline hover:bg-gold-050"
                  >
                    {dict.common.download}{' '}
                    <Bidi>{formatFileSize(publication.fileSize, locale)}</Bidi>
                  </a>
                ) : (
                  // A publication with no file in this locale is not an error —
                  // the reader is told which language it exists in.
                  <span className="text-caption text-ink-55">
                    {dict.resources.notAvailableInLocale}
                  </span>
                )}
              </div>
            </Panel>
          ))}
        </ul>
      )}
    </div>
  );
}
