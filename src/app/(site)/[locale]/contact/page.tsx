import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ComplaintForm, ContactForm } from '@/components/forms/public-forms';
import { Bidi } from '@/components/ui/bidi';
import { DefinitionList, Panel, Section, SectionHeading } from '@/components/ui/primitives';
import { getOrganization } from '@/db/queries/content';
import { buildWhatsAppUrl } from '@/lib/utils';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { formSlice, optionLabels } from '@/lib/i18n/form-dict';

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<'/[locale]/contact'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    title: dict.nav.contact,
    alternates: { canonical: `/${locale}/contact`, languages: { ar: '/ar/contact', en: '/en/contact' } },
  };
}

export default async function ContactPage({ params }: PageProps<'/[locale]/contact'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, org] = await Promise.all([getDictionary(locale), getOrganization(locale)]);
  const forms = formSlice(dict);
  const labels = optionLabels(dict);

  return (
    <div className="container-content section-gap">
      <SectionHeading as="h1" title={dict.nav.contact} />

      <div className="grid gap-10 md:grid-cols-[1fr_320px]">
        <div>
          <ContactForm dict={forms} locale={locale} labels={labels} />
        </div>

        <Panel as="aside" tone="alt">
          <h2 className="eyebrow mbe-4">{dict.footer.channelsTitle}</h2>
          <DefinitionList
            items={[
              {
                term: dict.forms.phone,
                value: org?.primaryPhone ? (
                  <a href={`tel:${org.primaryPhone}`}>
                    <Bidi>{org.primaryPhone}</Bidi>
                  </a>
                ) : null,
              },
              {
                term: 'WhatsApp',
                value: org?.whatsappNumber ? (
                  <a href={buildWhatsAppUrl(org.whatsappNumber)} rel="noopener noreferrer" target="_blank">
                    <Bidi>{org.whatsappNumber}</Bidi>
                  </a>
                ) : null,
              },
              {
                term: dict.forms.email,
                value: org?.email ? (
                  <a href={`mailto:${org.email}`}>
                    <Bidi>{org.email}</Bidi>
                  </a>
                ) : null,
              },
              { term: dict.forms.location, value: org?.address },
              { term: dict.about.identity, value: org?.officeHours },
            ]}
          />
        </Panel>
      </div>

      {/*
        The complaints mechanism lives on the contact page and is linked from
        the footer as `#complaint`. It is a separate form, not a category of the
        contact form, because everything about how it is stored differs.
      */}
      <Section id="complaint" labelledBy="contact-complaint">
        <SectionHeading id="contact-complaint" title={dict.footer.complaints} />
        <div className="max-w-[52rem]">
          <ComplaintForm dict={forms} locale={locale} labels={labels} />
        </div>
      </Section>
    </div>
  );
}
