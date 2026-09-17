import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { VolunteerForm } from '@/components/forms/public-forms';
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

/**
 * `/get-involved/volunteer` — the volunteer form. The title is a page key,
 * not the motivation field's label (SEO-011).
 */

export async function generateMetadata({ params }: PageProps<'/[locale]/get-involved/volunteer'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [dict, org] = await Promise.all([getDictionary(locale), getOrganization(locale)]);
  return buildMetadata({
    locale,
    path: '/get-involved/volunteer',
    title: dict.getInvolved.volunteerTitle,
    description: dict.getInvolved.volunteerLead,
    siteName: organizationName(org),
  });
}

export default async function VolunteerPage({ params }: PageProps<'/[locale]/get-involved/volunteer'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = await getDictionary(locale);

  return (
    <Container className="section-gap">
      <PageHeader
        eyebrow={dict.getInvolved.eyebrow}
        title={dict.getInvolved.volunteerTitle}
        lede={dict.getInvolved.volunteerLead}
        breadcrumbs={
          <SiteBreadcrumbs
            locale={locale}
            dict={dict}
            trail={[
              { label: dict.getInvolved.title, path: '/get-involved' },
              { label: dict.getInvolved.volunteerTitle, path: '/get-involved/volunteer' },
            ]}
          />
        }
      />
      <Panel tone="white" className="max-w-narrow rule-section">
        <p className="mbe-6 text-small text-ink-70">{dict.getInvolved.volunteerFormLead}</p>
        <VolunteerForm dict={formSlice(dict)} locale={locale} labels={optionLabels(dict)} />
      </Panel>
    </Container>
  );
}
