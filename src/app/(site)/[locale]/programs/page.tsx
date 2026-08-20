import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProgramCard } from '@/components/content/cards';
import { SectionHeading } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { listPrograms } from '@/db/queries/content';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<'/[locale]/programs'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    title: dict.programs.title,
    description: dict.programs.lead,
    alternates: { canonical: `/${locale}/programs`, languages: { ar: '/ar/programs', en: '/en/programs' } },
  };
}

export default async function ProgramsPage({ params }: PageProps<'/[locale]/programs'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, programs] = await Promise.all([getDictionary(locale), listPrograms(locale)]);

  return (
    <div className="container-content section-gap">
      <SectionHeading as="h1" title={dict.programs.title} lead={dict.programs.lead} />

      {programs.length === 0 ? (
        <EmptyState title={dict.states.emptyTitle} body={dict.states.emptyBody} />
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {programs.map((program) => (
            <ProgramCard key={program.id} program={program} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
