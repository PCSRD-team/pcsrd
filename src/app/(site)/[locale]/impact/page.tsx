import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import { MetricCard, MetricStatus, StoryCard } from '@/components/content/cards';
import { ContentBreadcrumbs } from '@/components/content/page-chrome';
import { getSiteName } from '@/components/content/site';
import { CollectionPageJsonLd } from '@/components/seo/json-ld';
import { Panel } from '@/components/ui/card';
import { DefinitionList } from '@/components/ui/definition-list';
import { EmptyState } from '@/components/ui/feedback';
import { Container, Grid, PageHeader, Section, SectionHeading } from '@/components/ui/layout';
import { StatGroup } from '@/components/ui/stat';
import { Eyebrow, Heading } from '@/components/ui/typography';
import { listMetrics, listPrograms, listStories } from '@/db/queries/content';
import { isLocale, localePath } from '@/lib/i18n/config';
import { getDictionary, type Dictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<'/[locale]/impact'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [dict, siteName] = await Promise.all([getDictionary(locale), getSiteName(locale)]);
  return buildMetadata({
    locale,
    path: '/impact',
    title: dict.impact.title,
    description: dict.impact.lead,
    siteName,
  });
}

/** The three verification states, explained once at the top of the page. */
function MethodPanel({ dict }: { dict: Dictionary }) {
  const rows = [
    { status: 'verified', body: dict.contentUi.methodVerified },
    { status: 'reported', body: dict.contentUi.methodReported },
    { status: 'target', body: dict.contentUi.methodTarget },
  ] as const;
  return (
    <Panel as="aside" padding="sm" labelledBy="impact-method">
      <Eyebrow id="impact-method">{dict.contentUi.methodTitle}</Eyebrow>
      <DefinitionList
        layout="ruled"
        className="mbs-3"
        items={rows.map((row) => ({
          term: dict.impact[row.status],
          value: (
            <span className="flex flex-wrap items-baseline gap-3">
              <MetricStatus status={row.status} dict={dict} />
              <span className="text-caption text-ink-70">{row.body}</span>
            </span>
          ),
        }))}
      />
    </Panel>
  );
}

export default async function ImpactPage({ params }: PageProps<'/[locale]/impact'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, metrics, stories, programs] = await Promise.all([
    getDictionary(locale),
    // `/impact` shows verified figures only. Targets live on the strategy page,
    // where the reader knows they are looking at an intention rather than a
    // result — the same table, two contexts, no editorial process required.
    listMetrics(locale, { status: 'verified' }),
    listStories(locale, { limit: 12 }),
    listPrograms(locale),
  ]);

  // Figures are grouped by programme, with the programme's accent rule on the
  // label tile; figures with no programme close the list under a general label.
  const groups = [
    ...programs
      .map((program) => ({
        key: program.key,
        title: program.title,
        accent: `var(${program.accentToken})`,
        metrics: metrics.filter((metric) => metric.programKey === program.key),
      }))
      .filter((group) => group.metrics.length > 0),
    ...(() => {
      const general = metrics.filter((metric) => !metric.programKey);
      return general.length > 0
        ? [{ key: 'general', title: dict.contentUi.generalMetrics, accent: null, metrics: general }]
        : [];
    })(),
  ];

  return (
    <Container className="section-gap">
      <CollectionPageJsonLd
        name={dict.impact.title}
        description={dict.impact.lead}
        url={localePath(locale, '/impact')}
        locale={locale}
        items={stories.map((story) => ({
          name: story.title,
          url: localePath(locale, `/impact/stories/${story.slug}`),
        }))}
      />

      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:items-start">
        <PageHeader
          className="mbe-0"
          title={dict.impact.title}
          lede={dict.impact.lead}
          breadcrumbs={<ContentBreadcrumbs locale={locale} dict={dict} trail={[{ label: dict.impact.title }]} />}
        />
        <MethodPanel dict={dict} />
      </div>

      <Section labelledBy="impact-figures">
        <SectionHeading id="impact-figures" title={dict.contentUi.metricsTitle} eyebrow={dict.impact.verified} />
        {groups.length === 0 ? (
          <EmptyState title={dict.states.emptyTitle} body={dict.states.emptyBody} />
        ) : (
          <div className="space-y-12">
            {groups.map((group) => (
              <div
                key={group.key}
                className="grid gap-6 md:grid-cols-[12.5rem_minmax(0,1fr)] md:gap-10"
                style={group.accent ? ({ '--accent': group.accent } as CSSProperties) : undefined}
              >
                <div className={group.accent ? 'rule-accent pbs-3' : 'rule-section pbs-3'}>
                  <Heading level={3} size="h4" id={`impact-group-${group.key}`}>
                    {group.title}
                  </Heading>
                </div>
                <StatGroup labelledBy={`impact-group-${group.key}`}>
                  {group.metrics.map((metric) => (
                    <MetricCard key={metric.id} metric={metric} locale={locale} dict={dict} />
                  ))}
                </StatGroup>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section labelledBy="impact-stories" tone="alt" className="px-5 md:px-8">
        <SectionHeading id="impact-stories" title={dict.impact.storiesTitle} lead={dict.contentUi.storiesLead} />
        {stories.length === 0 ? (
          <EmptyState title={dict.states.emptyTitle} body={dict.states.emptyBody} />
        ) : (
          <Grid as="ul" cols={3}>
            {stories.map((story) => (
              <li key={story.id} className="flex">
                <StoryCard story={story} locale={locale} dict={dict} />
              </li>
            ))}
          </Grid>
        )}
      </Section>
    </Container>
  );
}
