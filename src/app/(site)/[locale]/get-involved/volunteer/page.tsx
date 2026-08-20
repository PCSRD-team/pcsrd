import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { VolunteerForm } from '@/components/forms/public-forms';
import { SectionHeading } from '@/components/ui/primitives';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { formSlice, optionLabels } from '@/lib/i18n/form-dict';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/get-involved/volunteer'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    title: dict.forms.motivation,
    alternates: {
      canonical: `/${locale}/get-involved/volunteer`,
      languages: { ar: '/ar/get-involved/volunteer', en: '/en/get-involved/volunteer' },
    },
  };
}

export default async function VolunteerPage({
  params,
}: PageProps<'/[locale]/get-involved/volunteer'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = await getDictionary(locale);

  return (
    <div className="container-content section-gap">
      <SectionHeading as="h1" title={dict.careers.title} lead={dict.forms.motivation} />
      <div className="max-w-[52rem]">
        <VolunteerForm dict={formSlice(dict)} locale={locale} labels={optionLabels(dict)} />
      </div>
    </div>
  );
}
