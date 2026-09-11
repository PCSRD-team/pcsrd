import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ComplaintForm, ContactForm } from '@/components/forms/public-forms';
import { Bidi } from '@/components/ui/bidi';
import { getOrganization } from '@/db/queries/content';
import { buildWhatsAppUrl } from '@/lib/utils';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { formSlice, optionLabels } from '@/lib/i18n/form-dict';

export const revalidate = 3600;

function ContactIcon({ kind }: { kind: 'phone' | 'email' | 'location' | 'time' | 'message' | 'shield' }) {
  const paths = {
    phone: <path d="M7.2 3.5 9.6 8l-2.2 1.5a14 14 0 0 0 7.1 7.1l1.5-2.2 4.5 2.4-.8 3.2c-.3 1.1-1.3 1.8-2.4 1.7C9.5 20.8 3.2 14.5 2.3 6.7c-.1-1.1.6-2.1 1.7-2.4l3.2-.8Z" />,
    email: <><rect x="2.5" y="4.5" width="19" height="15" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    time: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
    message: <><path d="M4 4h16v12H8l-4 4V4Z" /><path d="M8 9h8M8 12h5" /></>,
    shield: <><path d="M12 2.5 20 6v5.5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3.5Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">{paths[kind]}</svg>;
}

function ContactDetail({ icon, label, children }: { icon: 'phone' | 'email' | 'location' | 'time'; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 border-be border-white/15 pbe-4 last:border-0 last:pbe-0">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-gold-600"><ContactIcon kind={icon} /></span>
      <div className="min-w-0">
        <p className="text-caption font-medium text-paper/65">{label}</p>
        <div className="mbs-1 break-words text-small text-paper [&_a]:text-paper [&_a:hover]:text-gold-600">{children}</div>
      </div>
    </div>
  );
}

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
  const officialChannels = (org?.officialChannels ?? [])
    .filter((channel) => channel.visible !== false && channel.is_official)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const hasContactDetails = Boolean(
    org?.primaryPhone || org?.whatsappNumber || org?.email || org?.address || org?.officeHours,
  );

  return (
    <main>
      <header className="bg-navy-900 text-paper">
        <div className="container-content py-12 md:py-16">
          <p className="eyebrow text-gold-600">{dict.contactPage.eyebrow}</p>
          <h1 className="mbs-3 max-w-3xl text-h1 font-semibold text-paper">{dict.nav.contact}</h1>
          <p className="mbs-4 max-w-2xl text-lead text-paper/75">{dict.contactPage.lead}</p>
        </div>
      </header>

      <div className="container-content py-12 md:py-16">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.72fr)]">
          <section aria-labelledby="contact-form-title" className="rounded-3xl border border-rule bg-paper p-5 shadow-[0_18px_50px_rgb(20_33_63/0.08)] md:p-8">
            <div className="mbe-7 border-be border-rule pbe-5">
              <div className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gold-050 text-gold-700"><ContactIcon kind="message" /></span>
                <div>
                  <h2 id="contact-form-title" className="text-h3 font-semibold text-ink">{dict.contactPage.formTitle}</h2>
                  <p className="mbs-2 max-w-2xl text-small text-ink-55">{dict.contactPage.formLead}</p>
                </div>
              </div>
            </div>
            <ContactForm dict={forms} locale={locale} labels={labels} />
            <p className="mbs-5 flex items-start gap-2 rounded-xl bg-navy-100/55 p-4 text-caption text-ink-70">
              <span className="text-navy-700"><ContactIcon kind="shield" /></span>
              {dict.contactPage.responseNote}
            </p>
          </section>

          <aside className="overflow-hidden rounded-3xl bg-navy-900 text-paper shadow-[0_18px_50px_rgb(20_33_63/0.14)] lg:sticky lg:inset-bs-28">
            <div className="border-be border-white/15 bg-navy-700/45 p-6">
              <h2 className="text-h3 font-semibold text-paper">{dict.contactPage.detailsTitle}</h2>
              <p className="mbs-2 text-small text-paper/70">{dict.contactPage.detailsLead}</p>
            </div>
            <div className="space-y-4 p-6">
              {org?.primaryPhone ? <ContactDetail icon="phone" label={dict.forms.phone}><a href={`tel:${org.primaryPhone}`}><Bidi>{org.primaryPhone}</Bidi></a></ContactDetail> : null}
              {org?.whatsappNumber ? <ContactDetail icon="phone" label="WhatsApp"><a href={buildWhatsAppUrl(org.whatsappNumber)} rel="noopener noreferrer" target="_blank"><Bidi>{org.whatsappNumber}</Bidi></a></ContactDetail> : null}
              {org?.email ? <ContactDetail icon="email" label={dict.forms.email}><a href={`mailto:${org.email}`}><Bidi>{org.email}</Bidi></a></ContactDetail> : null}
              {org?.address ? <ContactDetail icon="location" label={dict.forms.location}>{org.address}</ContactDetail> : null}
              {org?.officeHours ? <ContactDetail icon="time" label={dict.about.identity}>{org.officeHours}</ContactDetail> : null}
              {!hasContactDetails ? <p className="text-small text-paper/70">{dict.contactPage.noContactDetails}</p> : null}
            </div>

            {officialChannels.length ? (
              <div className="border-bs border-white/15 p-6">
                <h3 className="text-small font-semibold text-paper">{dict.contactPage.officialChannels}</h3>
                <ul className="mbs-3 flex flex-wrap gap-2">
                  {officialChannels.map((channel) => (
                    <li key={`${channel.platform}-${channel.url}`}>
                      <a href={channel.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-full border border-white/20 px-4 text-caption text-paper no-underline hover:border-gold-600 hover:text-gold-600">
                        {channel.platform} · <Bidi>{channel.handle}</Bidi>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="border-bs border-white/15 p-6">
              <Link href={`/${locale}/verify`} className="inline-flex min-h-11 items-center border-be-2 border-gold-600 text-small font-medium text-paper no-underline hover:text-gold-600">
                {dict.contactPage.verifyChannels}
              </Link>
            </div>
          </aside>
        </div>

        <section id="complaint" aria-labelledby="contact-complaint" className="scroll-mbs-28 py-14 md:py-20">
          <div className="rounded-3xl border border-gold-600/35 bg-gold-050/70 p-5 md:p-8 lg:p-10">
            <div className="grid items-start gap-8 lg:grid-cols-[0.72fr_1.45fr]">
              <div className="lg:sticky lg:inset-bs-28">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-navy-900 text-gold-600"><ContactIcon kind="shield" /></span>
                <p className="eyebrow mbs-5 text-gold-700">{dict.contactPage.complaintsEyebrow}</p>
                <h2 id="contact-complaint" className="mbs-2 text-h2 font-semibold text-ink">{dict.footer.complaints}</h2>
                <p className="mbs-4 text-body text-ink-70">{dict.contactPage.complaintsLead}</p>
              </div>
              <div className="rounded-2xl border border-white bg-paper p-5 shadow-[0_14px_36px_rgb(20_33_63/0.07)] md:p-7">
                <h3 className="mbe-6 border-be border-rule pbe-4 text-h3 font-semibold text-ink">{dict.contactPage.complaintFormTitle}</h3>
                <ComplaintForm dict={forms} locale={locale} labels={labels} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
