import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PartnershipForm } from '@/components/forms/public-forms';
import { organizationName } from '@/components/layout/chrome';
import { SiteBreadcrumbs } from '@/components/layout/site-breadcrumbs';
import { Panel } from '@/components/ui/card';
import { Container, PageHeader } from '@/components/ui/layout';
import { getOrganization } from '@/db/queries/content';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { formSlice, optionLabels } from '@/lib/i18n/form-dict';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

/** `/get-involved/partner` — the partnership enquiry. Journey J3's destination. */

export async function generateMetadata({ params }: PageProps<'/[locale]/get-involved/partner'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [dict, org] = await Promise.all([getDictionary(locale), getOrganization(locale)]);
  return buildMetadata({
    locale,
    path: '/get-involved/partner',
    title: dict.getInvolved.partnerTitle,
    description: dict.getInvolved.partnerLead,
    siteName: organizationName(org),
  });
}

export default async function PartnerPage({ params }: PageProps<'/[locale]/get-involved/partner'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = await getDictionary(locale);

  return (
    <Container className="section-gap">
      <PageHeader
        eyebrow={dict.getInvolved.eyebrow}
        title={dict.getInvolved.partnerTitle}
        lede={dict.getInvolved.partnerLead}
        breadcrumbs={
          <SiteBreadcrumbs
            locale={locale}
            dict={dict}
            trail={[
              { label: dict.getInvolved.title, path: '/get-involved' },
              { label: dict.getInvolved.partnerTitle, path: '/get-involved/partner' },
            ]}
          />
        }
      />
      <Panel tone="white" className="max-w-narrow rule-section">
        <p className="mbe-6 text-small text-ink-70">{dict.getInvolved.partnerFormLead}</p>
        <PartnershipForm dict={formSlice(dict)} locale={locale} labels={optionLabels(dict)} />
      </Panel>
    </Container>
  );
}
