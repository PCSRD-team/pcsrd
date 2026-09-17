import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { organizationName } from '@/components/layout/chrome';
import { SiteBreadcrumbs } from '@/components/layout/site-breadcrumbs';
import { Container, PageHeader } from '@/components/ui/layout';
import { getOrganization } from '@/db/queries/content';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata } from '@/lib/seo/metadata';
import { InvolvementCards } from './_components/involvement-cards';

export const revalidate = 3600;

/** `/get-involved` — the index of the three routes: partner, volunteer, support. */

export async function generateMetadata({ params }: PageProps<'/[locale]/get-involved'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [dict, org] = await Promise.all([getDictionary(locale), getOrganization(locale)]);
  return buildMetadata({
    locale,
    path: '/get-involved',
    title: dict.getInvolved.title,
    description: dict.getInvolved.lead,
    siteName: organizationName(org),
  });
}

export default async function GetInvolvedPage({ params }: PageProps<'/[locale]/get-involved'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  return (
    <Container className="section-gap">
      <PageHeader
        eyebrow={dict.getInvolved.eyebrow}
        title={dict.getInvolved.title}
        lede={dict.getInvolved.lead}
        breadcrumbs={
          <SiteBreadcrumbs locale={locale} dict={dict} trail={[{ label: dict.getInvolved.title, path: '/get-involved' }]} />
        }
      />
      <InvolvementCards locale={locale} dict={dict} />
    </Container>
  );
}
