import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { organizationName, visibleText } from '@/components/layout/chrome';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Grid, Section, SectionHeading } from '@/components/ui/layout';
import { Prose } from '@/components/ui/typography';
import { getOrganization, listPartners, listPeople } from '@/db/queries/content';
import { isLocale, localePath } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata } from '@/lib/seo/metadata';
import { ABOUT_PATHS, AboutShell, aboutSectionLead, aboutSectionTitle, type AboutSection } from './_components/about-shell';
import { GovernanceGroups } from './_components/governance';
import { IdentityRecord } from './_components/identity-record';
import { MembershipList, membershipPartners } from './_components/memberships';
import { StrategicObjectives } from './_components/strategy';
import { TitledBlockList, VisionMission } from './_components/vision-mission';

export const revalidate = 3600;

/**
 * `/about` — the overview of the due-diligence cluster. It carries the
 * identity record and a summary of each sub-page, and links out to the four
 * focused pages. Every fact reads from `organization_settings`, `people` and
 * `partners`; nothing here is typed in.
 */

export async function generateMetadata({ params }: PageProps<'/[locale]/about'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [dict, org] = await Promise.all([getDictionary(locale), getOrganization(locale)]);
  return buildMetadata({
    locale,
    path: ABOUT_PATHS.overview,
    title: dict.about.title,
    description: dict.aboutPages.overviewLead,
    siteName: organizationName(org),
  });
}

const SUB_SECTIONS: AboutSection[] = ['vision-mission', 'governance', 'strategy', 'memberships'];

export default async function AboutPage({ params }: PageProps<'/[locale]/about'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, org, people, partners] = await Promise.all([
    getDictionary(locale),
    getOrganization(locale),
    listPeople(locale),
    listPartners(locale),
  ]);

  const intro = visibleText(org?.shortDescription);
  const board = people.filter((person) => person.category === 'board').slice(0, 4);
  const memberships = membershipPartners(partners).slice(0, 4);

  return (
    <AboutShell locale={locale} dict={dict} current="overview">
      {/* Intro + identity ledger — the two-column grid the design opens with. */}
      <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          {intro ? (
            <Prose measure="reading">
              <p className="text-lead text-ink-70">{intro}</p>
            </Prose>
          ) : null}
          <TitledBlockList
            id="about-values"
            blocks={org?.coreValues}
            locale={locale}
            title={dict.about.values}
            lead={dict.aboutPages.valuesLead}
          />
        </div>
        <IdentityRecord org={org ?? null} dict={dict} locale={locale} />
      </div>

      <VisionMission org={org ?? null} dict={dict} />

      {/* The four sub-pages, as a row of records. */}
      <Section spacing="none" labelledBy="about-sections">
        <SectionHeading id="about-sections" title={dict.aboutPages.sectionsTitle} />
        <Grid as="ul" cols={4} gap={6}>
          {SUB_SECTIONS.map((section) => (
            <Card as="li" key={section} interactive padding="md">
              <CardBody>
                <h3 className="text-h4 font-semibold text-ink">
                  <Link
                    href={localePath(locale, ABOUT_PATHS[section])}
                    className="text-ink no-underline after:absolute after:inset-0 hover:text-gold-700"
                  >
                    {aboutSectionTitle(dict, section)}
                  </Link>
                </h3>
                <p className="mbs-2 text-small text-ink-70">{aboutSectionLead(dict, section)}</p>
              </CardBody>
              <span aria-hidden="true" className="mbs-4 text-ink-55">
                <Icon name="arrow" size={20} />
              </span>
            </Card>
          ))}
        </Grid>
      </Section>

      {/* Board — first four, linking to the full governance page. */}
      {board.length > 0 ? (
        <Section spacing="none" labelledBy="about-board">
          <SectionHeading
            id="about-board"
            title={dict.about.board}
            actions={
              <ButtonLink href={localePath(locale, ABOUT_PATHS.governance)} tone="marked" size="sm">
                {dict.about.governance}
              </ButtonLink>
            }
          />
          <GovernanceGroups people={board} dict={dict} categories={['board']} headingLevel={3} />
        </Section>
      ) : null}

      {/* Strategy — the objectives, linking to the full plan. */}
      {(org?.strategicObjectives ?? []).length > 0 ? (
        <Section spacing="none" labelledBy="about-strategy">
          <SectionHeading
            id="about-strategy"
            title={dict.about.strategy}
            lead={dict.aboutPages.strategyLead}
            actions={
              <ButtonLink href={localePath(locale, ABOUT_PATHS.strategy)} tone="marked" size="sm">
                {dict.common.readMore}
              </ButtonLink>
            }
          />
          <StrategicObjectives lines={org?.strategicObjectives} locale={locale} dict={dict} heading={false} id="about-strategy" />
        </Section>
      ) : null}

      {/* Memberships — the first few, linking to the full list. */}
      {memberships.length > 0 ? (
        <Section spacing="none" labelledBy="about-membership">
          <SectionHeading
            id="about-membership"
            title={dict.about.membership}
            actions={
              <ButtonLink href={localePath(locale, ABOUT_PATHS.memberships)} tone="marked" size="sm">
                {dict.common.viewAll}
              </ButtonLink>
            }
          />
          <MembershipList partners={memberships} dict={dict} locale={locale} heading={false} id="about-membership" />
        </Section>
      ) : null}
    </AboutShell>
  );
}
