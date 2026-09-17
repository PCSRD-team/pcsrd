import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { mediaImage } from '@/components/content/media';
import { ContentBreadcrumbs } from '@/components/content/page-chrome';
import { getSiteName } from '@/components/content/site';
import { Bidi } from '@/components/ui/bidi';
import { EmptyState } from '@/components/ui/feedback';
import { LogoTile } from '@/components/ui/figure';
import { Container, Grid, PageHeader, Section, SectionHeading } from '@/components/ui/layout';
import { Table } from '@/components/ui/table';
import { Caption } from '@/components/ui/typography';
import { listPartners } from '@/db/queries/content';
import type { PartnerType } from '@/db/schema/enums';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<'/[locale]/partners'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [dict, siteName] = await Promise.all([getDictionary(locale), getSiteName(locale)]);
  return buildMetadata({
    locale,
    path: '/partners',
    title: dict.partners.title,
    description: dict.partners.lead,
    siteName,
  });
}

const GROUPS: PartnerType[] = ['implementing', 'donor', 'network', 'membership'];

/** Strips the scheme for display; the link keeps it. */
const bareHost = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

/**
 * Partners grouped by type. Implementing partners are logo tiles — the
 * relationship is visual; donors, networks and memberships are a register,
 * because what a due-diligence reader wants there is the name, the sector
 * and the site, comparable down the column.
 *
 * `logoPath` is already `null` unless permission was granted — the gate is
 * in the query — so a tile without a logo sets the name in type instead.
 */
export default async function PartnersPage({ params }: PageProps<'/[locale]/partners'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, partners] = await Promise.all([getDictionary(locale), listPartners(locale)]);

  return (
    <Container className="section-gap">
      <PageHeader
        title={dict.partners.title}
        lede={dict.partners.lead}
        breadcrumbs={<ContentBreadcrumbs locale={locale} dict={dict} trail={[{ label: dict.partners.title }]} />}
      />

      {partners.length === 0 ? (
        <EmptyState title={dict.states.emptyTitle} body={dict.states.emptyBody} bounded />
      ) : (
        GROUPS.map((group) => {
          const members = partners.filter((partner) => partner.type === group);
          if (members.length === 0) return null;
          const headingId = `partners-${group}`;
          const title = dict.enums.partnerType[group];

          if (group === 'implementing') {
            return (
              <Section key={group} labelledBy={headingId}>
                <SectionHeading id={headingId} title={title} />
                <Grid as="ul" cols={4} gap={4}>
                  {members.map((partner) => (
                    <li key={partner.id}>
                      <LogoTile
                        image={mediaImage(partner.logoPath)}
                        name={partner.logoAlt ?? partner.name ?? ''}
                        href={partner.website}
                      />
                      <Caption className="mbs-2">
                        {partner.name}
                        {partner.sector ? <span className="text-ink-55"> · {partner.sector}</span> : null}
                        {!partner.logoPath ? <span className="block">{dict.partners.logoWithheld}</span> : null}
                      </Caption>
                    </li>
                  ))}
                </Grid>
              </Section>
            );
          }

          return (
            <Section key={group} labelledBy={headingId}>
              <SectionHeading id={headingId} title={title} />
              <Table
                caption={title}
                captionHidden
                rows={members}
                empty={dict.states.emptyBody}
                columns={[
                  {
                    key: 'name',
                    header: dict.forms.name,
                    rowHeader: true,
                    cell: (partner) => partner.name,
                  },
                  {
                    key: 'sector',
                    header: dict.forms.organizationType,
                    cell: (partner) => partner.sector ?? '—',
                  },
                  {
                    key: 'website',
                    header: dict.contentUi.partnerWebsite,
                    numeric: true,
                    align: 'start',
                    cell: (partner) =>
                      partner.website ? (
                        <a href={partner.website} rel="noopener noreferrer" target="_blank">
                          <Bidi>{bareHost(partner.website)}</Bidi>
                        </a>
                      ) : (
                        '—'
                      ),
                  },
                ]}
              />
            </Section>
          );
        })
      )}
    </Container>
  );
}
