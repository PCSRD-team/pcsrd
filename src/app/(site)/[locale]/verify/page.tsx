import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FraudReportForm } from '@/components/forms/public-forms';
import { Bidi } from '@/components/ui/bidi';
import { Badge, Panel, Section, SectionHeading } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { getOrganization } from '@/db/queries/content';
import { buildWhatsAppUrl } from '@/lib/utils';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { formSlice, optionLabels } from '@/lib/i18n/form-dict';

/**
 * `/verify` — the authoritative list of official channels.
 *
 * This is one of the two jobs the site exists to do. Its readers are
 * beneficiaries and donors trying to tell the organisation from someone
 * soliciting money in its name, so the page states both halves: what **is**
 * ours, and — where the organisation has documented one — what is **not**.
 *
 * Every handle is `<bdi>`-isolated. A Latin handle inside an Arabic sentence
 * renders with its punctuation reordered otherwise, and a reader comparing it
 * character by character against a suspicious account is exactly the reader who
 * cannot afford that.
 */
export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<'/[locale]/verify'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    title: dict.verify.title,
    description: dict.verify.lead,
    alternates: { canonical: `/${locale}/verify`, languages: { ar: '/ar/verify', en: '/en/verify' } },
  };
}

export default async function VerifyPage({ params }: PageProps<'/[locale]/verify'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, org] = await Promise.all([getDictionary(locale), getOrganization(locale)]);

  const channels = org?.officialChannels ?? [];
  const official = channels.filter((c) => c.is_official);
  const impostors = channels.filter((c) => !c.is_official);

  return (
    <div className="container-content section-gap">
      <SectionHeading as="h1" title={dict.verify.title} lead={dict.verify.lead} />

      {official.length === 0 ? (
        <EmptyState title={dict.states.emptyTitle} body={dict.states.emptyBody} />
      ) : (
        <Panel tone="gold" className="p-0">
          {/* The admin's DataTable has this wrapper and this three-column table
              did not, so a long handle or URL widened the whole document and
              /ar/verify scrolled sideways in its entirety. That is the worst
              page for it to happen on: it exists so a beneficiary can compare a
              handle character by character against a suspicious account, and it
              is the one most likely to be opened on a cheap phone. */}
          <div className="overflow-x-auto">
            <table className="w-full text-start">
            <caption className="sr-only">{dict.verify.title}</caption>
            <thead>
              <tr className="border-be-2 border-ink">
                <th scope="col" className="eyebrow p-4 text-start">
                  {dict.verify.channel}
                </th>
                <th scope="col" className="eyebrow p-4 text-start">
                  {dict.verify.handle}
                </th>
                <th scope="col" className="eyebrow p-4 text-start">
                  {dict.verify.official}
                </th>
              </tr>
            </thead>
            <tbody>
              {official.map((channel) => (
                <tr key={`${channel.platform}:${channel.handle}`} className="border-be border-hairline">
                  <td className="p-4 text-small font-medium text-ink">{channel.platform}</td>
                  <td className="p-4">
                    <a href={channel.url} rel="noopener noreferrer me" target="_blank" className="font-mono text-caption">
                      <Bidi>{channel.handle}</Bidi>
                    </a>
                  </td>
                  <td className="p-4">
                    <Badge tone="verified">{dict.verify.official}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </Panel>
      )}

      {org?.whatsappNumber ? (
        <p className="mbs-6 text-small text-ink-70">
          WhatsApp:{' '}
          <a href={buildWhatsAppUrl(org.whatsappNumber)} rel="noopener noreferrer" target="_blank">
            <Bidi>{org.whatsappNumber}</Bidi>
          </a>
        </p>
      ) : null}

      {/* Naming a documented impostor is more useful than describing one. It is
          only rendered when the organisation has recorded it — nothing here is
          inferred. */}
      {impostors.length > 0 ? (
        <Section labelledBy="verify-impostors">
          <SectionHeading id="verify-impostors" title={dict.verify.notOurs} />
          <ul className="space-y-3">
            {impostors.map((channel) => (
              <Panel as="li" key={`${channel.platform}:${channel.handle}`} className="flex flex-wrap items-baseline gap-4">
                <span className="text-small font-medium text-ink">{channel.platform}</span>
                <span className="font-mono text-caption">
                  <Bidi>{channel.handle}</Bidi>
                </span>
                <Badge tone="warning">{dict.verify.notOurs}</Badge>
                {(locale === 'ar' ? channel.note_ar : channel.note_en) ? (
                  <p className="w-full text-caption text-ink-55">
                    {locale === 'ar' ? channel.note_ar : channel.note_en}
                  </p>
                ) : null}
              </Panel>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section id="report" labelledBy="verify-report">
        <SectionHeading
          id="verify-report"
          title={dict.verify.reportTitle}
          lead={dict.verify.reportLead}
        />
        <div className="max-w-[52rem]">
          <FraudReportForm
            dict={formSlice(dict)}
            locale={locale}
            labels={optionLabels(dict)}
          />
        </div>
      </Section>
    </div>
  );
}
