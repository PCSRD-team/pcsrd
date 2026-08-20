import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PartnershipForm } from '@/components/forms/public-forms';
import { SectionHeading } from '@/components/ui/primitives';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { formSlice, optionLabels } from '@/lib/i18n/form-dict';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/get-involved/partner'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    title: dict.nav.partner,
    alternates: {
      canonical: `/${locale}/get-involved/partner`,
      languages: { ar: '/ar/get-involved/partner', en: '/en/get-involved/partner' },
    },
  };
}

export default async function PartnerPage({ params }: PageProps<'/[locale]/get-involved/partner'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = await getDictionary(locale);

  return (
    <div className="container-content section-gap">
      <SectionHeading as="h1" title={dict.nav.partner} />
      <div className="max-w-[52rem]">
        <PartnershipForm dict={formSlice(dict)} locale={locale} labels={optionLabels(dict)} />
      </div>
    </div>
  );
}
