import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { organizationName, visibleText } from '@/components/layout/chrome';
import { SiteBreadcrumbs } from '@/components/layout/site-breadcrumbs';
import { Bidi } from '@/components/ui/bidi';
import { ButtonLink } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Icon } from '@/components/ui/icon';
import { Container, PageHeader } from '@/components/ui/layout';
import { Notice } from '@/components/ui/notice';
import { Heading, Prose } from '@/components/ui/typography';
import { getOrganization } from '@/db/queries/content';
import { isLocale, localePath } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata } from '@/lib/seo/metadata';
import { buildWhatsAppUrl } from '@/lib/utils';

export const revalidate = 3600;

/**
 * `/get-involved/support` — WhatsApp only (03-FRONTEND §6.3).
 *
 * The site takes no payments. The page says how support reaches the
 * organisation today — a conversation on its official WhatsApp number, read
 * from `organization_settings` — and puts the verify callout beside it,
 * because the support page is the one most often impersonated.
 */

export async function generateMetadata({ params }: PageProps<'/[locale]/get-involved/support'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [dict, org] = await Promise.all([getDictionary(locale), getOrganization(locale)]);
  return buildMetadata({
    locale,
    path: '/get-involved/support',
    title: dict.getInvolved.supportTitle,
    description: dict.getInvolved.supportLead,
    siteName: organizationName(org),
  });
}

export default async function SupportPage({ params }: PageProps<'/[locale]/get-involved/support'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, org] = await Promise.all([getDictionary(locale), getOrganization(locale)]);
  const whatsapp = visibleText(org?.whatsappNumber);
  const whatsappUrl = whatsapp ? buildWhatsAppUrl(whatsapp, dict.getInvolved.whatsappMessage) : null;

  return (
    <Container className="section-gap">
      <PageHeader
        eyebrow={dict.getInvolved.eyebrow}
        title={dict.getInvolved.supportTitle}
        lede={dict.getInvolved.supportLead}
        breadcrumbs={
          <SiteBreadcrumbs
            locale={locale}
            dict={dict}
            trail={[
              { label: dict.getInvolved.title, path: '/get-involved' },
              { label: dict.getInvolved.supportTitle, path: '/get-involved/support' },
            ]}
          />
        }
      />

      <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <Prose measure="reading">
            <p>{dict.getInvolved.supportBody}</p>
          </Prose>

          {whatsapp && whatsappUrl ? (
            <div className="mbs-8 flex flex-wrap items-center gap-4">
              <ButtonLink href={whatsappUrl} external tone="primary" size="lg">
                <Icon name="phone" size={20} />
                {dict.getInvolved.whatsappCta}
                <Bidi className="font-mono text-small font-normal opacity-85">{whatsapp}</Bidi>
              </ButtonLink>
              <ButtonLink href={localePath(locale, '/contact')} tone="quiet">
                {dict.getInvolved.contactAlternative}
              </ButtonLink>
            </div>
          ) : (
            <EmptyState
              className="mbs-8"
              title={dict.getInvolved.whatsappUnavailableTitle}
              body={dict.getInvolved.whatsappUnavailableBody}
              action={
                <>
                  <ButtonLink href={localePath(locale, '/contact')} tone="primary">
                    {dict.nav.contact}
                  </ButtonLink>
                  <ButtonLink href={localePath(locale, '/verify')} tone="secondary">
                    {dict.nav.verify}
                  </ButtonLink>
                </>
              }
            />
          )}
        </div>

        {/* The verify callout: the attestation ground, opened by the 2px gold rule. */}
        <Panel as="aside" tone="gold" className="border-bs-2 border-bs-gold-600" labelledBy="support-verify">
          <Heading level={2} size="h3" id="support-verify">
            {dict.getInvolved.verifyCalloutTitle}
          </Heading>
          <p className="mbs-3 text-small text-ink-70">{dict.getInvolved.verifyCalloutBody}</p>
          <p className="mbs-3 text-small text-ink-70">{dict.home.verifyLead}</p>
          <div className="mbs-6 flex flex-wrap gap-3">
            <ButtonLink href={localePath(locale, '/verify')} tone="primary">
              {dict.getInvolved.verifyCalloutCta}
            </ButtonLink>
            <ButtonLink href={`${localePath(locale, '/verify')}#report`} tone="secondary">
              {dict.verify.reportTitle}
            </ButtonLink>
          </div>
          <Notice tone="info" live="off" className="mbs-6">
            <p className="font-medium text-ink">{dict.getInvolved.partnerTitle}</p>
            <p className="mbs-1 text-caption text-ink-70">{dict.getInvolved.partnerLead}</p>
            <p className="mbs-3">
              <ButtonLink href={localePath(locale, '/get-involved/partner')} tone="secondary" size="sm">
                {dict.nav.partner}
              </ButtonLink>
            </p>
          </Notice>
        </Panel>
      </div>
    </Container>
  );
}
