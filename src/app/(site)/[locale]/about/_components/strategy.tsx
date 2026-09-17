import { visibleText } from '@/components/layout/chrome';
import { Bidi, DateText } from '@/components/ui/bidi';
import { ButtonLink } from '@/components/ui/button';
import { RuledList, RuledListItem } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Icon } from '@/components/ui/icon';
import { Section, SectionHeading } from '@/components/ui/layout';
import { Stat, StatGroup } from '@/components/ui/stat';
import type { listMetrics, listPublications } from '@/db/queries/content';
import type { BilingualLine } from '@/db/schema/organization';
import { publicEnv } from '@/lib/env.public';
import { formatFileSize, formatNumber, formatPeriod, storageUrl } from '@/lib/format';
import type { Locale } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n/get-dictionary';

export type Metric = Awaited<ReturnType<typeof listMetrics>>[number];
export type Publication = Awaited<ReturnType<typeof listPublications>>[number];

export function resolveLines(lines: BilingualLine[] | null | undefined, locale: Locale): string[] {
  return (lines ?? []).flatMap((line) => {
    const text = visibleText(locale === 'en' ? (line.text_en ?? line.text_ar) : line.text_ar);
    return text ? [text] : [];
  });
}

/** `SO-1`, `SO-2`… — the mono code beside each strategic objective, as in the design. */
function objectiveCode(index: number) {
  return `SO-${index + 1}`;
}

/** Strategic objectives as a ruled list opened by the 2px rule. */
export function StrategicObjectives({
  lines,
  locale,
  dict,
  id = 'about-objectives',
  heading = true,
}: {
  lines: BilingualLine[] | null | undefined;
  locale: Locale;
  dict: Dictionary;
  id?: string;
  heading?: boolean;
}) {
  const objectives = resolveLines(lines, locale);
  if (objectives.length === 0) return null;

  const list = (
    <RuledList as="ol" bounded>
      {objectives.map((objective, index) => (
        <RuledListItem key={`${index}-${objective}`} className="items-baseline gap-4 py-4">
          <Bidi className="font-mono text-eyebrow font-medium text-gold-700">{objectiveCode(index)}</Bidi>
          <span className="min-w-0 flex-1 text-body font-medium text-ink">{objective}</span>
        </RuledListItem>
      ))}
    </RuledList>
  );
  if (!heading) return list;

  return (
    <Section spacing="none" bounded={false} labelledBy={id}>
      <SectionHeading id={id} title={dict.aboutPages.objectivesTitle} />
      {list}
    </Section>
  );
}

/** Metrics with `status = 'target'`: a figure locked to its period and its "target" status. */
export function StrategyTargets({
  metrics,
  locale,
  dict,
  id = 'about-targets',
}: {
  metrics: Metric[];
  locale: Locale;
  dict: Dictionary;
  id?: string;
}) {
  if (metrics.length === 0) return null;
  const statusLabel = { verified: dict.impact.verified, reported: dict.impact.reported, target: dict.impact.target };

  return (
    <Section spacing="none" labelledBy={id} className="pbs-8">
      <SectionHeading id={id} title={dict.aboutPages.targetsTitle} lead={dict.aboutPages.targetsLead} />
      <StatGroup labelledBy={id}>
        {metrics.map((metric) => (
          <Stat
            key={metric.id}
            as="li"
            locale={locale}
            value={formatNumber(metric.value, locale)}
            unit={metric.unit}
            label={metric.label ?? ''}
            prefix={metric.displayPrefix === '+' || metric.displayPrefix === '~' ? metric.displayPrefix : null}
            period={{
              start: metric.periodStart,
              end: metric.periodEnd,
              label: formatPeriod(metric.periodStart, metric.periodEnd, locale),
            }}
            verification={{
              status: metric.status,
              label: statusLabel[metric.status],
              source: metric.verificationSource,
            }}
          />
        ))}
      </StatGroup>
    </Section>
  );
}

/** Publications of type `strategy`, as downloadable rows. */
export function StrategyDocuments({
  publications,
  locale,
  dict,
  id = 'about-strategy-documents',
}: {
  publications: Publication[];
  locale: Locale;
  dict: Dictionary;
  id?: string;
}) {
  if (publications.length === 0) return null;

  return (
    <Section spacing="none" labelledBy={id} className="pbs-8">
      <SectionHeading id={id} title={dict.aboutPages.strategyDocumentsTitle} />
      <RuledList bounded>
        {publications.map((publication) => {
          const href = publication.filePath
            ? storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, 'documents', publication.filePath)
            : null;
          return (
            <RuledListItem key={publication.id} className="justify-between py-4">
              <div className="min-w-0 flex-1">
                <p className="text-body font-medium text-ink">{publication.title}</p>
                {publication.description ? (
                  <p className="mbs-1 text-small text-ink-70">{publication.description}</p>
                ) : null}
                <p className="mbs-1 font-mono text-eyebrow text-mono-muted">
                  {publication.publishedYear ? (
                    <>
                      {dict.aboutPages.publishedYear}{' '}
                      <DateText locale={locale}>{String(publication.publishedYear)}</DateText>
                    </>
                  ) : null}
                  {publication.publishedYear && publication.fileSize ? ' · ' : null}
                  {publication.fileSize ? (
                    <Bidi>{formatFileSize(publication.fileSize, locale)}</Bidi>
                  ) : null}
                </p>
              </div>
              {href ? (
                <ButtonLink href={href} tone="secondary" size="sm" download>
                  <Icon name="download" size={16} />
                  {dict.aboutPages.downloadDocument}
                </ButtonLink>
              ) : null}
            </RuledListItem>
          );
        })}
      </RuledList>
    </Section>
  );
}

export function StrategyEmpty({ dict }: { dict: Dictionary }) {
  return <EmptyState bounded title={dict.aboutPages.strategyEmptyTitle} body={dict.aboutPages.strategyEmptyBody} />;
}
