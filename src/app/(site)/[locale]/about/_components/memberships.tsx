import { visibleText } from '@/components/layout/chrome';
import { Badge } from '@/components/ui/badge';
import { Bidi } from '@/components/ui/bidi';
import { ButtonLink } from '@/components/ui/button';
import { RuledList, RuledListItem } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Icon } from '@/components/ui/icon';
import { Section, SectionHeading } from '@/components/ui/layout';
import type { listPartners } from '@/db/queries/content';
import { type Locale, localePath } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n/get-dictionary';

export type Partner = Awaited<ReturnType<typeof listPartners>>[number];

/** The subset of partners that are networks or memberships. */
export function membershipPartners(partners: Partner[]) {
  return partners.filter((partner) => partner.type === 'network' || partner.type === 'membership');
}

/**
 * The design lists memberships as ruled rows, not logo tiles: network name,
 * membership level as a chip, a description line, and the network's site.
 * A logo needs permission the organisation may not hold; the name never does.
 */
function MembershipRow({ partner, dict }: { partner: Partner; dict: Dictionary }) {
  const name = visibleText(partner.name) ?? '';
  const website = visibleText(partner.website);
  const levelLabel =
    partner.membershipLevel === 'full'
      ? dict.aboutPages.membershipFull
      : partner.membershipLevel === 'observer'
        ? dict.aboutPages.membershipObserver
        : null;

  return (
    <RuledListItem className="items-start py-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-body font-semibold text-ink">{name}</p>
          <Badge tone="neutral">{dict.enums.partnerType[partner.type]}</Badge>
          {levelLabel ? <Badge tone={partner.membershipLevel === 'full' ? 'success' : 'neutral'}>{levelLabel}</Badge> : null}
        </div>
        {visibleText(partner.sector) ? <p className="mbs-1 text-caption text-ink-55">{partner.sector}</p> : null}
        {visibleText(partner.description) ? <p className="measure mbs-2 text-small text-ink-70">{partner.description}</p> : null}
      </div>
      {website ? (
        <ButtonLink href={website} external tone="quiet" size="sm" ariaLabel={`${dict.aboutPages.website}: ${name}`}>
          <Bidi>{website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</Bidi>
          <Icon name="external" size={16} />
        </ButtonLink>
      ) : null}
    </RuledListItem>
  );
}

export function MembershipList({
  partners,
  dict,
  locale,
  id = 'about-memberships',
  heading = true,
}: {
  partners: Partner[];
  dict: Dictionary;
  locale: Locale;
  id?: string;
  heading?: boolean;
}) {
  const networks = partners.filter((partner) => partner.type === 'network');
  const memberships = partners.filter((partner) => partner.type === 'membership');

  if (networks.length === 0 && memberships.length === 0) {
    return (
      <EmptyState
        bounded
        title={dict.aboutPages.membershipsEmptyTitle}
        body={dict.aboutPages.membershipsEmptyBody}
        action={
          <ButtonLink href={localePath(locale, '/partners')} tone="secondary">
            {dict.aboutPages.allPartners}
          </ButtonLink>
        }
      />
    );
  }

  const groups = [
    { id: `${id}-networks`, title: dict.aboutPages.networksTitle, items: networks },
    { id: `${id}-memberships`, title: dict.aboutPages.membershipsTitle, items: memberships },
  ].filter((group) => group.items.length > 0);

  if (!heading) {
    return (
      <RuledList bounded>
        {[...networks, ...memberships].map((partner) => (
          <MembershipRow key={partner.id} partner={partner} dict={dict} />
        ))}
      </RuledList>
    );
  }

  return (
    <div className="space-y-12">
      {groups.map((group) => (
        <Section key={group.id} spacing="none" bounded={false} labelledBy={group.id}>
          <SectionHeading id={group.id} title={group.title} />
          <RuledList bounded>
            {group.items.map((partner) => (
              <MembershipRow key={partner.id} partner={partner} dict={dict} />
            ))}
          </RuledList>
        </Section>
      ))}
    </div>
  );
}
