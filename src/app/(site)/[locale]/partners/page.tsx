import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Bidi } from '@/components/ui/bidi';
import { Panel, Section, SectionHeading } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { listPartners } from '@/db/queries/content';
import { publicEnv } from '@/lib/env.public';
import { storageUrl } from '@/lib/format';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import type { PartnerType } from '@/db/schema/enums';

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<'/[locale]/partners'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    title: dict.partners.title,
    description: dict.partners.lead,
    alternates: { canonical: `/${locale}/partners`, languages: { ar: '/ar/partners', en: '/en/partners' } },
  };
}

const GROUPS: PartnerType[] = ['implementing', 'donor', 'network', 'membership'];

export default async function PartnersPage({ params }: PageProps<'/[locale]/partners'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, partners] = await Promise.all([getDictionary(locale), listPartners(locale)]);

  if (partners.length === 0) {
    return (
      <div className="container-content section-gap">
        <SectionHeading as="h1" title={dict.partners.title} lead={dict.partners.lead} />
        <EmptyState title={dict.states.emptyTitle} body={dict.states.emptyBody} />
      </div>
    );
  }

  return (
    <div className="container-content section-gap">
      <SectionHeading as="h1" title={dict.partners.title} lead={dict.partners.lead} />

      {GROUPS.map((group) => {
        const members = partners.filter((p) => p.type === group);
        if (members.length === 0) return null;

        return (
          <Section key={group} labelledBy={`partners-${group}`}>
            <SectionHeading id={`partners-${group}`} title={dict.enums.partnerType[group]} />
            <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {members.map((partner) => (
                <Panel as="li" key={partner.id} className="flex flex-col gap-3">
                  {/* `logoPath` is already null unless permission was granted —
                      the gate is in the query, so there is nothing to check
                      here. What is left is telling the reader why a logo is
                      missing rather than showing a blank frame. */}
                  {partner.logoPath ? (
                    <div className="relative h-16 w-full">
                      <Image
                        src={storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, 'media', partner.logoPath)}
                        alt={partner.logoAlt ?? partner.name ?? ''}
                        fill
                        sizes="200px"
                        className="object-contain object-start"
                      />
                    </div>
                  ) : null}
                  <h3 className="text-h3 font-semibold text-ink">{partner.name}</h3>
                  {partner.sector ? (
                    <p className="text-caption text-ink-55">{partner.sector}</p>
                  ) : null}
                  {partner.website ? (
                    <a href={partner.website} rel="noopener noreferrer" target="_blank" className="text-caption">
                      <Bidi>{partner.website.replace(/^https?:\/\//, '')}</Bidi>
                    </a>
                  ) : null}
                </Panel>
              ))}
            </ul>
          </Section>
        );
      })}
    </div>
  );
}
