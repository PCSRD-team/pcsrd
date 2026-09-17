import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ComplaintForm, ContactForm } from '@/components/forms/public-forms';
import { organizationName, visibleText } from '@/components/layout/chrome';
import { SiteBreadcrumbs } from '@/components/layout/site-breadcrumbs';
import { Bidi } from '@/components/ui/bidi';
import { ButtonLink } from '@/components/ui/button';
import { Panel, RuledList, RuledListItem } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Container, PageHeader, Section, SectionHeading } from '@/components/ui/layout';
import { Notice } from '@/components/ui/notice';
import { Eyebrow, Heading } from '@/components/ui/typography';
import { getOrganization } from '@/db/queries/content';
import { isLocale, localePath } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { formSlice, optionLabels } from '@/lib/i18n/form-dict';
import { buildMetadata } from '@/lib/seo/metadata';
import { buildWhatsAppUrl } from '@/lib/utils';

export const revalidate = 3600;

/**
 * `/contact` — the general form, the direct channels, and the confidential
 * complaint channel. The complaint form stores no IP hash and fires no
 * analytics event; that is enforced in the action, and stated on the page.
 */

export async function generateMetadata({ params }: PageProps<'/[locale]/contact'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [dict, org] = await Promise.all([getDictionary(locale), getOrganization(locale)]);
  return buildMetadata({
    locale,
    path: '/contact',
    title: dict.nav.contact,
    description: dict.contactPage.lead,
    siteName: organizationName(org),
  });
}

function ChannelRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <RuledListItem className="justify-between gap-x-6 gap-y-1">
      <Eyebrow as="span">{label}</Eyebrow>
      <span className="text-small text-ink">{children}</span>
    </RuledListItem>
  );
}

export default async function ContactPage({ params }: PageProps<'/[locale]/contact'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, org] = await Promise.all([getDictionary(locale), getOrganization(locale)]);
  const forms = formSlice(dict);
  const labels = optionLabels(dict);

  const phone = visibleText(org?.primaryPhone);
  const whatsapp = visibleText(org?.whatsappNumber);
  const email = visibleText(org?.email);
  const address = visibleText(org?.address);
  const officeHours = visibleText(org?.officeHours);
  const hasContactDetails = Boolean(phone || whatsapp || email || address || officeHours);
  const officialChannels = (org?.officialChannels ?? [])
    .filter((channel) => channel.visible !== false && channel.is_official)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  return (
    <>
      <Container className="section-gap">
        <PageHeader
          eyebrow={dict.contactPage.eyebrow}
          title={dict.nav.contact}
          lede={dict.contactPage.lead}
          breadcrumbs={<SiteBreadcrumbs locale={locale} dict={dict} trail={[{ label: dict.nav.contact, path: '/contact' }]} />}
        />

        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,400px)] lg:gap-16">
          <Section as="section" spacing="none" labelledBy="contact-form-title" className="pbs-6">
            <Heading level={2} size="h3" id="contact-form-title">
              {dict.contactPage.formTitle}
            </Heading>
            <p className="mbs-2 max-w-2xl text-small text-ink-55">{dict.contactPage.formLead}</p>
            <div className="mbs-6">
              <ContactForm dict={forms} locale={locale} labels={labels} />
            </div>
            <Notice tone="info" live="off" className="mbs-6">
              {dict.contactPage.responseNote}
            </Notice>
          </Section>

          <aside aria-labelledby="contact-details-title">
            <Eyebrow as="p" id="contact-details-title" className="mbe-3">
              {dict.contactPage.detailsTitle}
            </Eyebrow>
            <p className="mbe-4 text-small text-ink-70">{dict.contactPage.detailsLead}</p>
            {hasContactDetails ? (
              <RuledList bounded>
                {phone ? (
                  <ChannelRow label={dict.siteChrome.phone}>
                    <a href={`tel:${phone}`}>
                      <Bidi>{phone}</Bidi>
                    </a>
                  </ChannelRow>
                ) : null}
                {whatsapp ? (
                  <ChannelRow label={dict.siteChrome.whatsapp}>
                    <a href={buildWhatsAppUrl(whatsapp)} rel="noopener noreferrer" target="_blank">
                      <Bidi>{whatsapp}</Bidi>
                    </a>
                  </ChannelRow>
                ) : null}
                {email ? (
                  <ChannelRow label={dict.siteChrome.email}>
                    <a href={`mailto:${email}`}>
                      <Bidi>{email}</Bidi>
                    </a>
                  </ChannelRow>
                ) : null}
                {officeHours ? <ChannelRow label={dict.siteChrome.officeHours}>{officeHours}</ChannelRow> : null}
                {address ? <ChannelRow label={dict.siteChrome.address}>{address}</ChannelRow> : null}
              </RuledList>
            ) : (
              <p className="text-small text-ink-55">{dict.contactPage.noContactDetails}</p>
            )}

            {officialChannels.length > 0 ? (
              <div className="mbs-8">
                <Eyebrow as="p" className="mbe-3">
                  {dict.contactPage.officialChannels}
                </Eyebrow>
                <ul className="flex flex-wrap gap-2">
                  {officialChannels.map((channel) => (
                    <li key={`${channel.platform}-${channel.url}`}>
                      <a
                        href={channel.url}
                        target="_blank"
                        rel="noopener noreferrer me"
                        className="inline-flex min-h-target items-center gap-2 rule-edge bg-paper px-3 text-caption text-ink no-underline hover:bg-paper-alt"
                      >
                        <span>{channel.platform}</span>
                        <Bidi className="font-mono">{channel.handle}</Bidi>
                        <Icon name="external" size={16} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Panel tone="gold" padding="sm" className="mbs-8 border-s-2 border-s-gold-600" role="note">
              <p className="text-small font-medium text-ink">{dict.getInvolved.verifyCalloutTitle}</p>
              <p className="mbs-1 text-caption text-ink-70">{dict.getInvolved.verifyCalloutBody}</p>
              <p className="mbs-3">
                <ButtonLink href={localePath(locale, '/verify')} tone="marked" size="sm">
                  {dict.contactPage.verifyChannels}
                </ButtonLink>
              </p>
            </Panel>
          </aside>
        </div>
      </Container>

      {/* The confidential complaint channel: a full-width navy band, anchored for the footer link. */}
      <Section id="complaint" tone="inverse" labelledBy="contact-complaint" bounded={false} className="scroll-mbs-28">
        <Container className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <SectionHeading
              id="contact-complaint"
              eyebrow={dict.contactPage.complaintsEyebrow}
              title={dict.footer.complaints}
              lead={dict.contactPage.complaintsLead}
              className="[&_h2]:text-paper [&_p]:text-paper"
            />
            <p className="max-w-prose text-small text-paper">{dict.forms.anonymousNotice}</p>
          </div>
          <Panel tone="white" labelledBy="contact-complaint-form" className="rule-section">
            <Heading level={3} size="h4" id="contact-complaint-form" className="mbe-6">
              {dict.contactPage.complaintFormTitle}
            </Heading>
            <ComplaintForm dict={forms} locale={locale} labels={labels} />
          </Panel>
        </Container>
      </Section>
    </>
  );
}
