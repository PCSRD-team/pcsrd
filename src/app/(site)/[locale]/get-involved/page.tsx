import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { organizationName } from '@/components/layout/chrome';
import { SiteBreadcrumbs } from '@/components/layout/site-breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { Container, PageHeader } from '@/components/ui/layout';
import { Heading } from '@/components/ui/typography';
import { getOrganization } from '@/db/queries/content';
import { isLocale, localePath } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata } from '@/lib/seo/metadata';
import { InvolvementCards } from './_components/involvement-cards';

export const revalidate = 3600;

/**
 * `/get-involved` — the index of the three routes: partner, volunteer, support,
 * and under them the shortest way to give, straight to `/donate`.
 */

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
      <Panel as="aside" labelledBy="get-involved-donate" className="mbs-10 border-bs-2 border-bs-ink">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-prose">
            <Heading level={2} size="h4" id="get-involved-donate">
              {dict.donate.eyebrow}
            </Heading>
            <p className="mbs-2 text-small text-ink-70">{dict.donate.lead}</p>
          </div>
          <ButtonLink href={localePath(locale, '/donate')} tone="primary">
            {dict.donate.navCta}
          </ButtonLink>
        </div>
      </Panel>
    </Container>
  );
}
