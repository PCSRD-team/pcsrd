import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { VacancyCard } from '@/components/content/cards';
import { SectionHeading } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { listOpenVacancies } from '@/db/queries/content';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<'/[locale]/careers'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    title: dict.careers.title,
    description: dict.careers.lead,
    alternates: { canonical: `/${locale}/careers`, languages: { ar: '/ar/careers', en: '/en/careers' } },
  };
}

export default async function CareersPage({ params }: PageProps<'/[locale]/careers'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, vacancies] = await Promise.all([
    getDictionary(locale),
    listOpenVacancies(locale),
  ]);

  return (
    <div className="container-content section-gap">
      <SectionHeading as="h1" title={dict.careers.title} lead={dict.careers.lead} />

      {vacancies.length === 0 ? (
        // "No openings" is a real answer, not an error. The generic empty state
        // would leave an applicant wondering whether the page failed to load.
        <EmptyState title={dict.careers.noOpenings} body={dict.states.emptyBody} />
      ) : (
        <ul className="space-y-4">
          {vacancies.map((vacancy) => (
            <VacancyCard key={vacancy.id} vacancy={vacancy} locale={locale} dict={dict} />
          ))}
        </ul>
      )}
    </div>
  );
}
