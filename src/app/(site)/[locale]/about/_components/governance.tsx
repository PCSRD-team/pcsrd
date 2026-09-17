import { visibleText } from '@/components/layout/chrome';
import { Card, CardBody, CardMedia } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Figure } from '@/components/ui/figure';
import { Grid, Section, SectionHeading } from '@/components/ui/layout';
import { Notice } from '@/components/ui/notice';
import { Heading } from '@/components/ui/typography';
import type { listPeople } from '@/db/queries/content';
import type { PersonCategory } from '@/db/schema/enums';
import { publicEnv } from '@/lib/env.public';
import { storageUrl } from '@/lib/format';
import type { Dictionary } from '@/lib/i18n/get-dictionary';

export type Person = Awaited<ReturnType<typeof listPeople>>[number];

/** Board first, then executive management, then staff — the order of accountability. */
export const PERSON_CATEGORIES: PersonCategory[] = ['board', 'executive', 'staff'];

/**
 * One person: 2px ink rule, a square portrait slot that keeps its shape with
 * no photo (the common case — a portrait needs documented consent), name, role.
 */
export function PersonCard({ person, dict }: { person: Person; dict: Dictionary }) {
  const name = visibleText(person.name) ?? '';
  const image = person.photoPath
    ? {
        src: storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, 'media', person.photoPath),
        blurDataURL: person.photoBlur ?? undefined,
      }
    : null;

  return (
    <Card as="li" padding="md" className="rule-section">
      <CardMedia ratio="square">
        <Figure
          image={image}
          alt={visibleText(person.photoAlt) ?? name}
          sizes="(min-width: 1024px) 270px, (min-width: 640px) 45vw, 100vw"
          ratio="square"
          fallbackLabel={dict.states.emptyTitle}
        />
      </CardMedia>
      <CardBody>
        <p className="text-body font-semibold text-ink">{name}</p>
        {visibleText(person.role) ? <p className="mbs-1 text-small text-ink-55">{person.role}</p> : null}
        {visibleText(person.bio) ? <p className="mbs-3 text-caption text-ink-70">{person.bio}</p> : null}
      </CardBody>
    </Card>
  );
}

/**
 * People grouped by category. Only `is_public` rows reach this component —
 * the query enforces it (DNH-5) — and the consent note says so on the page,
 * because an absent name on a governance page reads as a gap unless it is
 * explained.
 */
export function GovernanceGroups({
  people,
  dict,
  categories = PERSON_CATEGORIES,
  headingLevel = 2,
}: {
  people: Person[];
  dict: Dictionary;
  categories?: PersonCategory[];
  headingLevel?: 2 | 3;
}) {
  const groups = categories
    .map((category) => ({ category, members: people.filter((person) => person.category === category) }))
    .filter((group) => group.members.length > 0);

  if (groups.length === 0) {
    return (
      <EmptyState
        bounded
        title={dict.aboutPages.governanceEmptyTitle}
        body={dict.aboutPages.governanceEmptyBody}
        footnote={dict.aboutPages.governanceConsentNote}
      />
    );
  }

  return (
    <div className="space-y-12">
      {groups.map((group) => {
        const id = `governance-${group.category}`;
        return (
          <Section key={group.category} spacing="none" labelledBy={id} className="pbs-6">
            {headingLevel === 2 ? (
              <SectionHeading id={id} title={dict.enums.personCategory[group.category]} />
            ) : (
              <Heading level={3} id={id} className="mbe-6">
                {dict.enums.personCategory[group.category]}
              </Heading>
            )}
            <Grid as="ul" cols={4} gap={6}>
              {group.members.map((person) => (
                <PersonCard key={person.id} person={person} dict={dict} />
              ))}
            </Grid>
          </Section>
        );
      })}
      <Notice tone="info" live="off">
        {dict.aboutPages.governanceConsentNote}
      </Notice>
    </div>
  );
}
