import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FraudReportForm } from '@/components/forms/public-forms';
import { organizationName, visibleText } from '@/components/layout/chrome';
import { SiteBreadcrumbs } from '@/components/layout/site-breadcrumbs';
import { Badge } from '@/components/ui/badge';
import { Bidi } from '@/components/ui/bidi';
import { ButtonLink } from '@/components/ui/button';
import { Panel, RuledList, RuledListItem } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Icon } from '@/components/ui/icon';
import { Container, PageHeader, Section, SectionHeading } from '@/components/ui/layout';
import { Table, type Column } from '@/components/ui/table';
import { getOrganization, getPageByKey } from '@/db/queries/content';
import type { OfficialChannel } from '@/db/schema/organization';
import { isLocale, localePath } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { formSlice, optionLabels } from '@/lib/i18n/form-dict';
import { buildMetadata } from '@/lib/seo/metadata';
import { buildWhatsAppUrl } from '@/lib/utils';

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

type ChannelRow = OfficialChannel & { id: string };

export async function generateMetadata({ params }: PageProps<'/[locale]/verify'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [dict, org, page] = await Promise.all([
    getDictionary(locale),
    getOrganization(locale),
    getPageByKey('verify', locale),
  ]);
  return buildMetadata({
    locale,
    path: '/verify',
    title: page?.title ?? dict.verify.title,
    description: dict.verify.lead,
    siteName: organizationName(org),
  });
}

export default async function VerifyPage({ params }: PageProps<'/[locale]/verify'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, org] = await Promise.all([getDictionary(locale), getOrganization(locale)]);

  const channels: ChannelRow[] = (org?.officialChannels ?? [])
    .filter((channel) => channel.visible !== false)
    .map((channel) => ({ ...channel, id: `${channel.platform}:${channel.handle}` }));
  const official = channels.filter((channel) => channel.is_official);
  const impostors = channels.filter((channel) => !channel.is_official);
  const whatsapp = visibleText(org?.whatsappNumber);
  /** The recorded note for this locale, falling back to the Arabic original. */
  const channelNote = (channel: ChannelRow) =>
    visibleText(locale === 'ar' ? channel.note_ar : (channel.note_en ?? channel.note_ar));

  /**
   * Two columns, not three.
   *
   * The third was headed "official" and every cell under it was a badge
   * reading "official" — on a table that filters to `is_official` and sits on
   * the attestation ground. It restated its own header once per row, cost the
   * widest no-wrap column on a 375px screen, and said nothing a reader could
   * act on. The attestation now appears once, as a stamp in the page header,
   * which is where a stamp belongs; the column it freed carries the note the
   * organisation recorded against the channel — information that existed in
   * `official_channels` and was rendered only for impostors.
   */
  const columns: Column<ChannelRow>[] = [
    { key: 'platform', header: dict.verify.channel, rowHeader: true, cell: (row) => row.platform },
    {
      key: 'handle',
      header: dict.verify.handle,
      cell: (row) => (
        <span className="flex flex-col gap-1">
          <a
            href={row.url}
            rel="noopener noreferrer me"
            target="_blank"
            className="inline-flex min-h-target items-center gap-2 font-mono text-caption"
          >
            <Bidi>{row.handle}</Bidi>
            <Icon name="external" size={16} />
          </a>
          {channelNote(row) ? (
            <span className="text-caption text-ink-55">{channelNote(row)}</span>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <Container className="section-gap">
      <PageHeader
        eyebrow={dict.channels.barLabel}
        title={dict.verify.title}
        lede={dict.verify.lead}
        breadcrumbs={<SiteBreadcrumbs locale={locale} dict={dict} trail={[{ label: dict.nav.verify, path: '/verify' }]} />}
        // The attestation, stated once for the whole list rather than repeated
        // in a column that was headed with the same word.
        meta={official.length > 0 ? <Badge tone="verified">{dict.verify.official}</Badge> : null}
        actions={
          <ButtonLink href="#report" tone="marked" size="sm">
            {dict.verify.reportTitle}
          </ButtonLink>
        }
      />

      {/* The attestation ground for the table: gold, like a verified figure. */}
      <Panel tone="gold" padding="sm">
        <Table
          caption={dict.verify.title}
          captionHidden
          rows={official}
          columns={columns}
          empty={<EmptyState title={dict.states.emptyTitle} body={dict.states.emptyBody} />}
        />
      </Panel>

      {whatsapp ? (
        <p className="mbs-6 text-small text-ink-70">
          {dict.siteChrome.whatsapp}:{' '}
          <a href={buildWhatsAppUrl(whatsapp)} rel="noopener noreferrer" target="_blank">
            <Bidi>{whatsapp}</Bidi>
          </a>
        </p>
      ) : null}

      {/* Naming a documented impostor is more useful than describing one. It is
          only rendered when the organisation has recorded it — nothing here is
          inferred. */}
      {impostors.length > 0 ? (
        <Section labelledBy="verify-impostors">
          <SectionHeading id="verify-impostors" title={dict.verify.notOurs} />
          <RuledList bounded>
            {impostors.map((channel) => {
              const note = channelNote(channel);
              return (
                <RuledListItem key={channel.id} className="items-baseline">
                  <span className="text-small font-medium text-ink">{channel.platform}</span>
                  <Bidi className="font-mono text-caption">{channel.handle}</Bidi>
                  <Badge tone="danger">{dict.verify.notOurs}</Badge>
                  {note ? <p className="w-full text-caption text-ink-55">{note}</p> : null}
                </RuledListItem>
              );
            })}
          </RuledList>
        </Section>
      ) : null}

      <Section id="report" labelledBy="verify-report" className="scroll-mbs-28">
        <SectionHeading id="verify-report" title={dict.verify.reportTitle} lead={dict.verify.reportLead} />
        <Panel tone="white" className="max-w-narrow">
          <FraudReportForm dict={formSlice(dict)} locale={locale} labels={optionLabels(dict)} />
        </Panel>
        <p className="mbs-6 text-small text-ink-70">
          <ButtonLink href={localePath(locale, '/contact')} tone="quiet" size="sm">
            {dict.getInvolved.contactAlternative}
          </ButtonLink>
        </p>
      </Section>
    </Container>
  );
}
