import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MetricCard } from '@/components/content/cards';
import { mediaImage } from '@/components/content/media';
import { ContentBreadcrumbs, ProjectsRail, TranslationNotice } from '@/components/content/page-chrome';
import { RichText } from '@/components/content/rich-text';
import { getSiteName, toTranslationStatus } from '@/components/content/site';
import { ProgramJsonLd } from '@/components/seo/json-ld';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, Panel } from '@/components/ui/card';
import { Figure } from '@/components/ui/figure';
import { Container, Grid, PageHeader, Section, SectionHeading } from '@/components/ui/layout';
import { StatGroup } from '@/components/ui/stat';
import { Eyebrow, Heading, Lede, Prose } from '@/components/ui/typography';
import { getProgramBySlug, listMetrics, listProgramSlugs, listPrograms } from '@/db/queries/content';
import { listProjects } from '@/db/queries/projects';
import { prerenderData } from '@/lib/build-time';
import { isLocale, localePath } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata, seoFallback } from '@/lib/seo/metadata';

export const revalidate = 3600;

/**
 * Both locales are pre-rendered for every published programme (three
 * programmes, six pages). An `ar_only` programme is still served on demand
 * at its English URL — it is just not prerendered, matching the sitemap.
 */
export async function generateStaticParams() {
  const rows = await prerenderData('static params programmes', () => listProgramSlugs(), []);
  return rows.flatMap((row) => [
    { locale: 'ar', slug: row.slugAr },
    ...(row.translationStatus === 'ar_only' ? [] : [{ locale: 'en', slug: row.slugEn }]),
  ]);
}

export async function generateMetadata({ params }: PageProps<'/[locale]/programs/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const [program, siteName] = await Promise.all([getProgramBySlug(slug, locale), getSiteName(locale)]);
  if (!program) return {};

  // SEO-013: the English title is read on English pages, falling back to Arabic.
  const seoTitle = locale === 'ar' ? program.seoTitleAr : program.seoTitleEn?.trim() || program.seoTitleAr;
  const seoDescription =
    locale === 'ar' ? program.seoDescriptionAr : program.seoDescriptionEn?.trim() || program.seoDescriptionAr;

  return buildMetadata({
    locale,
    path: { ar: `/programs/${program.slugAr}`, en: `/programs/${program.slugEn}` },
    title: seoFallback(seoTitle, program.title, siteName),
    description: seoFallback(seoDescription, program.tagline),
    siteName,
    translationStatus: toTranslationStatus(program.translationStatus),
    noIndex: program.noIndex,
  });
}

export default async function ProgramPage({ params }: PageProps<'/[locale]/programs/[slug]'>) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, program] = await Promise.all([getDictionary(locale), getProgramBySlug(slug, locale)]);
  if (!program) notFound();

  const [projects, metrics, allPrograms] = await Promise.all([
    listProjects(locale, { program: program.key, page: 1 }),
    listMetrics(locale, { programKey: program.key }),
    listPrograms(locale),
  ]);

  const targetGroupLabel = (key: string) =>
    (dict.enums.targetGroup as Record<string, string>)[key] ?? key;
  const audience = program.targetGroups.map(targetGroupLabel);
  const otherPrograms = allPrograms.filter((other) => other.id !== program.id);
  const accent = `var(${program.accentToken})`;
  const path = `/programs/${program.slugAr}`;

  return (
    <Container className="section-gap">
      <ProgramJsonLd
        name={program.title}
        description={program.tagline}
        url={localePath(locale, `/programs/${slug}`)}
        locale={locale}
        audience={audience}
      />

      <TranslationNotice locale={locale} dict={dict} isTranslated={program.isTranslated} arabicPath={path} />

      {/* Hero: the programme's 2px accent rule above the eyebrow is its
          identity mark — a rule in the programme colour, never a fill. */}
      <div
        className="grid gap-8 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:items-start"
        style={{ '--accent': accent } as CSSProperties}
      >
        <PageHeader
          className="mbe-0"
          breadcrumbs={
            <ContentBreadcrumbs
              locale={locale}
              dict={dict}
              trail={[{ label: dict.programs.title, path: '/programs' }, { label: program.title ?? '' }]}
            />
          }
          eyebrow={dict.programs.title}
          title={program.title ?? ''}
          lede={program.tagline}
          meta={
            audience.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label={dict.programs.targetGroups}>
                {audience.map((label) => (
                  <li key={label}>
                    <Badge tone="accent" accent={accent} uppercase={false}>
                      {label}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : null
          }
        />
        <Figure
          image={mediaImage(program.hero?.path, program.hero?.blur, program.hero)}
          alt={program.hero?.alt ?? ''}
          decorative={!program.hero?.alt}
          sizes="(min-width: 1180px) 500px, (min-width: 768px) 46vw, 100vw"
          // The LCP element on this route: the largest thing above the fold on
          // a desktop viewport. The only `preload` on the page.
          preload
          fallbackLabel={dict.contentUi.noImage}
        />
      </div>

      {program.introduction ? (
        <Section labelledBy="program-introduction" bounded={false} spacing="tight">
          <h2 id="program-introduction" className="sr-only">
            {program.title}
          </h2>
          <Prose measure="reading">
            <RichText doc={program.introduction} />
          </Prose>
        </Section>
      ) : null}

      {/*
        Eligibility and access come before the rationale. A beneficiary reading
        this page needs to know whether the service is for them and how to reach
        it; the strategic argument is for a different reader.
      */}
      {program.eligibility || program.howToAccess ? (
        <Section labelledBy="program-access" tone="alt" className="px-5 md:px-8">
          <SectionHeading id="program-access" title={dict.programs.howToAccess} />
          {/* Each panel had an eyebrow and a heading carrying the identical
              string — "الأهلية" over "الأهلية" — so the section printed its
              two labels four times between them. The heading stays (it is the
              one in the document outline); the eyebrow that only echoed it is
              gone. */}
          <Grid cols={2}>
            {program.eligibility ? (
              <Panel as="article" tone="paper">
                <Heading level={3} size="h3">
                  {dict.programs.eligibility}
                </Heading>
                <Prose className="mbs-4">
                  <RichText doc={program.eligibility} />
                </Prose>
              </Panel>
            ) : null}
            {program.howToAccess ? (
              <Panel as="article" tone="gold">
                <Heading level={3} size="h3">
                  {dict.programs.howToAccess}
                </Heading>
                <Prose className="mbs-4">
                  <RichText doc={program.howToAccess} />
                </Prose>
                <div className="mbs-6">
                  <ButtonLink href={localePath(locale, '/contact')} tone="secondary" size="sm">
                    {dict.nav.contact}
                  </ButtonLink>
                </div>
              </Panel>
            ) : null}
          </Grid>
        </Section>
      ) : null}

      {metrics.length > 0 ? (
        <Section labelledBy="program-metrics">
          <SectionHeading id="program-metrics" title={dict.impact.title} lead={dict.impact.lead} />
          <StatGroup>
            {metrics.map((metric) => (
              <MetricCard key={metric.id} metric={metric} locale={locale} dict={dict} />
            ))}
          </StatGroup>
        </Section>
      ) : null}

      {program.rationale || program.strategicObjective ? (
        <Section labelledBy="program-rationale">
          <SectionHeading id="program-rationale" title={dict.programs.objectives} />
          {program.strategicObjective ? <Lede className="mbe-6">{program.strategicObjective}</Lede> : null}
          {program.rationale ? (
            <Prose>
              <RichText doc={program.rationale} />
            </Prose>
          ) : null}
        </Section>
      ) : null}

      {program.sustainability ? (
        <Section labelledBy="program-sustainability">
          <SectionHeading id="program-sustainability" title={dict.programs.sustainability} />
          <Prose>
            <RichText doc={program.sustainability} />
          </Prose>
        </Section>
      ) : null}

      {program.impactStatement ? (
        <Section labelledBy="program-impact">
          <SectionHeading id="program-impact" title={dict.home.impactTitle} />
          <Prose>
            <RichText doc={program.impactStatement} />
          </Prose>
        </Section>
      ) : null}

      <ProjectsRail
        locale={locale}
        dict={dict}
        projects={projects.items}
        title={dict.programs.projectsInProgram}
        id="program-projects"
        actions={
          projects.total > projects.items.length ? (
            <ButtonLink
              href={localePath(locale, `/projects?program=${encodeURIComponent(program.key)}`)}
              tone="marked"
              size="sm"
            >
              {dict.common.viewAll}
            </ButtonLink>
          ) : null
        }
      />

      {otherPrograms.length > 0 ? (
        <Section labelledBy="program-others">
          <SectionHeading id="program-others" title={dict.home.programsTitle} />
          <Grid as="ul" cols={2}>
            {otherPrograms.map((other) => (
              <li key={other.id} className="flex">
                <Card as="article" accent={`var(${other.accentToken})`} interactive className="w-full">
                  <Eyebrow>{dict.programs.title}</Eyebrow>
                  <Heading level={3} size="h3" className="mbs-2">
                    <Link
                      href={localePath(locale, `/programs/${other.slug}`)}
                      className="text-ink no-underline hover:text-gold-700"
                    >
                      {other.title}
                    </Link>
                  </Heading>
                  {other.tagline ? <p className="mbs-3 text-small text-ink-70">{other.tagline}</p> : null}
                </Card>
              </li>
            ))}
          </Grid>
        </Section>
      ) : null}
    </Container>
  );
}
