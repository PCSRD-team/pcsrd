import { visibleText } from '@/components/layout/chrome';
import { EmptyState } from '@/components/ui/feedback';
import { Grid, Rule, Section, SectionHeading } from '@/components/ui/layout';
import { Heading } from '@/components/ui/typography';
import type { TitledBlock } from '@/db/schema/organization';
import type { Locale } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n/get-dictionary';
import type { Organization } from './identity-record';

/** A `TitledBlock` resolved for the locale; English falls back to Arabic. */
export function resolveBlocks(blocks: TitledBlock[] | null | undefined, locale: Locale) {
  return (blocks ?? []).flatMap((block) => {
    const title = visibleText(locale === 'en' ? (block.title_en ?? block.title_ar) : block.title_ar);
    const body = visibleText(locale === 'en' ? (block.body_en ?? block.body_ar) : block.body_ar);
    return title ? [{ title, body }] : [];
  });
}

/**
 * Vision and mission side by side, each opened by the gold mark. The design's
 * tinted band with a hairline above and below.
 */
export function VisionMission({
  org,
  dict,
  id = 'about-vision',
}: {
  org: Organization | null;
  dict: Dictionary;
  id?: string;
}) {
  const vision = visibleText(org?.vision);
  const mission = visibleText(org?.mission);
  if (!vision && !mission) return null;

  return (
    <Section tone="alt" spacing="tight" bounded={false} labelledBy={id} className="border-y border-rule px-6 md:px-8">
      <h2 id={id} className="sr-only">
        {dict.aboutPages.visionMissionTitle}
      </h2>
      <Grid cols={2} gap={10}>
        {vision ? (
          <div>
            <Rule weight="mark" as="span" className="mbe-4" />
            <Heading level={3} size="h3">
              {dict.about.vision}
            </Heading>
            <p className="measure mbs-3 text-lead text-ink-70">{vision}</p>
          </div>
        ) : null}
        {mission ? (
          <div>
            <Rule weight="mark" as="span" className="mbe-4" />
            <Heading level={3} size="h3">
              {dict.about.mission}
            </Heading>
            <p className="measure mbs-3 text-lead text-ink-70">{mission}</p>
          </div>
        ) : null}
      </Grid>
    </Section>
  );
}

/** Values or principles: bold title + one line, a hairline under each. */
export function TitledBlockList({
  blocks,
  locale,
  title,
  lead,
  id,
}: {
  blocks: TitledBlock[] | null | undefined;
  locale: Locale;
  title: string;
  lead?: string;
  id: string;
}) {
  const items = resolveBlocks(blocks, locale);
  if (items.length === 0) return null;

  return (
    <Section labelledBy={id} spacing="none" className="pbs-8">
      <SectionHeading id={id} title={title} lead={lead} />
      <Grid as="ul" cols={2} gap={0} className="gap-x-10">
        {items.map((item, index) => (
          <li key={`${index}-${item.title}`} className="border-be border-rule py-4">
            <p className="flex items-baseline gap-3">
              <span className="font-mono text-eyebrow text-mono-muted" dir="ltr">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="text-body font-semibold text-ink">{item.title}</span>
            </p>
            {item.body ? <p className="mbs-1 text-small text-ink-70">{item.body}</p> : null}
          </li>
        ))}
      </Grid>
    </Section>
  );
}

export function VisionMissionEmpty({ dict }: { dict: Dictionary }) {
  return (
    <EmptyState
      bounded
      title={dict.aboutPages.visionMissionEmptyTitle}
      body={dict.aboutPages.visionMissionEmptyBody}
    />
  );
}
