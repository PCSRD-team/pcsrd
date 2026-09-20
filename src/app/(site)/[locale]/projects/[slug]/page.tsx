import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { projectStateLabel } from '@/components/content/cards';
import { mediaImage, mediaSrc } from '@/components/content/media';
import { ContentBreadcrumbs, ProjectsRail, TranslationNotice } from '@/components/content/page-chrome';
import { RichText } from '@/components/content/rich-text';
import { getSiteName, toTranslationStatus } from '@/components/content/site';
import { ProjectJsonLd } from '@/components/seo/json-ld';
import { Badge } from '@/components/ui/badge';
import { DateText } from '@/components/ui/bidi';
import { ButtonLink } from '@/components/ui/button';
import { DefinitionList } from '@/components/ui/definition-list';
import { Figure } from '@/components/ui/figure';
import { Container, Grid, PageHeader, Section, SectionHeading } from '@/components/ui/layout';
import { Eyebrow, Prose } from '@/components/ui/typography';
import { getProjectBySlug, listProjectSlugs, listProjects } from '@/db/queries/projects';
import { prerenderData } from '@/lib/build-time';
import { formatPeriod } from '@/lib/format';
import { isLocale, localePath } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export async function generateStaticParams() {
  const rows = await prerenderData('static params projects', () => listProjectSlugs(), []);
  return rows.flatMap((row) => [
    { locale: 'ar', slug: row.slugAr },
    ...(row.translationStatus === 'ar_only' ? [] : [{ locale: 'en', slug: row.slugEn }]),
  ]);
}

export async function generateMetadata({ params }: PageProps<'/[locale]/projects/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const [project, siteName, slugs] = await Promise.all([
    getProjectBySlug(slug, locale),
    getSiteName(locale),
    // The detail query resolves `isTranslated` for one locale only; the
    // builder needs the raw status so the Arabic page of an `ar_only`
    // record also omits the `en` hreflang. The slug list (cached, small)
    // carries it.
    listProjectSlugs(),
  ]);
  if (!project) return {};
  const translationStatus =
    toTranslationStatus(slugs.find((row) => row.slugAr === project.slugAr)?.translationStatus) ??
    (project.isTranslated ? undefined : 'ar_only');

  return buildMetadata({
    locale,
    path: { ar: `/projects/${project.slugAr}`, en: `/projects/${project.slugEn}` },
    title: project.seoTitle?.trim() || project.title?.trim() || siteName,
    description: project.seoDescription ?? project.summary,
    siteName,
    translationStatus,
    noIndex: project.noIndex,
  });
}

const STATE_TONE = { active: 'active', completed: 'complete', planned: 'planned' } as const;


export default async function ProjectPage({ params }: PageProps<'/[locale]/projects/[slug]'>) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, project] = await Promise.all([getDictionary(locale), getProjectBySlug(slug, locale)]);
  if (!project) notFound();

  // Related projects: the same programme, minus this one. The rail reads
  // from the cached list query, so it costs nothing on a warm cache.
  const siblings = project.program
    ? await listProjects(locale, { program: project.program.key, page: 1 })
    : null;
  const related = (siblings?.items ?? []).filter((item) => item.id !== project.id).slice(0, 3);

  const govLabel = (key: string) => (dict.enums.governorate as Record<string, string>)[key] ?? key;
  const themeLabel = (key: string) => (dict.enums.theme as Record<string, string>)[key] ?? key;
  // Arabic comma for Arabic lists, Latin comma for English — from the
  // dictionary, not a ternary here.
  const separator = dict.common.listSeparator;
  const period = formatPeriod(project.startDate, project.endDate, locale);
  const hero = mediaImage(project.hero?.path, project.hero?.blur, project.hero);
  const url = localePath(locale, `/projects/${slug}`);

  return (
    <Container className="section-gap">
      <ProjectJsonLd
        name={project.title}
        description={project.summary}
        url={url}
        locale={locale}
        startDate={project.startDate}
        endDate={project.endDate}
        areaServed={project.governorates.map(govLabel)}
        funders={project.donors.map((donor) => ({ name: donor.name, url: donor.website }))}
        image={
          project.hero
            ? {
                url: mediaSrc(project.hero.path),
                width: project.hero.width,
                height: project.hero.height,
                alt: project.hero.alt,
              }
            : null
        }
      />

      <TranslationNotice
        locale={locale}
        dict={dict}
        isTranslated={project.isTranslated}
        arabicPath={`/projects/${project.slugAr}`}
      />

      <article className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_23.75rem] lg:gap-18">
        <div className="min-w-0">
          <PageHeader
            breadcrumbs={
              <ContentBreadcrumbs
                locale={locale}
                dict={dict}
                trail={[{ label: dict.projects.title, path: '/projects' }, { label: project.title ?? '' }]}
              />
            }
            eyebrow={project.program?.title ?? undefined}
            title={project.title ?? ''}
            lede={project.summary}
            // The programme is already the eyebrow directly above this row,
            // and the record aside carries a real "to the programme" button.
            // Naming it a third time, as a link one line under the eyebrow
            // that repeats it, gave the page two controls to the same URL and
            // the reader the same fact twice.
            meta={
              <Badge tone={STATE_TONE[project.state]} dot>
                {projectStateLabel(project.state, dict)}
              </Badge>
            }
          />

          {hero ? (
            <Figure
              image={hero}
              alt={project.hero?.alt ?? ''}
              decorative={!project.hero?.alt}
              // The narrative column is 600px at the 1180px content width
              // (1052px of column, minus the 380px record aside and the 72px
              // gap), not the 760px the old hint claimed — every desktop load
              // fetched one candidate step too large.
              sizes="(min-width: 1180px) 600px, (min-width: 1024px) 55vw, 100vw"
              // The LCP element on this route, and the only `preload` on it.
              preload
            />
          ) : null}

          {project.objective ? (
            <Section labelledBy="project-objective">
              <SectionHeading id="project-objective" title={dict.projects.objective} />
              <Prose>
                <RichText doc={project.objective} />
              </Prose>
            </Section>
          ) : null}

          {project.activities ? (
            <Section labelledBy="project-activities">
              <SectionHeading id="project-activities" title={dict.projects.activities} />
              <Prose>
                <RichText doc={project.activities} />
              </Prose>
            </Section>
          ) : null}

          {project.outcomes ? (
            <Section labelledBy="project-outcomes">
              <SectionHeading id="project-outcomes" title={dict.projects.outcomes} />
              <Prose>
                <RichText doc={project.outcomes} />
              </Prose>
            </Section>
          ) : null}

          {project.gallery.length > 0 ? (
            <Section labelledBy="project-gallery">
              <SectionHeading id="project-gallery" title={dict.projects.gallery} />
              <Grid as="ul" cols={3} gap={4}>
                {project.gallery.map((item) => (
                  <li key={item.path}>
                    {/* `alt` is the media asset's own — `alt_ar` is NOT NULL in
                        the schema, so a published image always has one. */}
                    <Figure
                      image={mediaImage(item.path, item.blur, item)}
                      alt={item.alt ?? ''}
                      ratio="portrait"
                      // Three-up inside the 600px narrative column, not the
                      // full content width: ~190px a tile at the top end.
                      sizes="(min-width: 1180px) 200px, (min-width: 640px) 30vw, 100vw"
                      caption={item.caption}
                    />
                  </li>
                ))}
              </Grid>
            </Section>
          ) : null}
        </div>

        {/* The record: period, status, locations, partners. This is what a
            due-diligence reader came for, so it opens with the 2px rule and
            sits beside the narrative rather than under it. */}
        <aside aria-labelledby="project-record" className="rule-section pbs-5 lg:sticky lg:inset-bs-6 lg:self-start">
          <Eyebrow id="project-record" as="p">
            {dict.about.identity}
          </Eyebrow>
          <DefinitionList
            layout="ruled"
            labelledBy="project-record"
            className="mbs-3"
            items={[
              {
                term: dict.projects.period,
                value: period ? <DateText locale={locale}>{period}</DateText> : null,
              },
              {
                term: dict.projects.governorate,
                value: project.governorates.length ? project.governorates.map(govLabel).join(separator) : null,
              },
              {
                term: dict.projects.locations,
                value: project.localities.length ? project.localities.join(separator) : null,
              },
              {
                term: dict.projects.theme,
                value: project.themes.length ? (
                  <ul className="flex flex-wrap gap-2">
                    {project.themes.map((theme) => (
                      <li key={theme}>
                        <Badge tone="neutral" uppercase={false}>
                          {themeLabel(theme)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : null,
              },
              {
                term: dict.projects.implementingPartners,
                value: project.implementingPartners.length
                  ? project.implementingPartners.map((p) => p.name).join(separator)
                  : null,
              },
              {
                term: dict.projects.donors,
                value: project.donors.length ? project.donors.map((p) => p.name).join(separator) : null,
              },
            ]}
          />
          <div className="mbs-6 flex flex-wrap gap-3">
            <ButtonLink href={localePath(locale, '/contact')} tone="primary" size="sm">
              {dict.nav.contact}
            </ButtonLink>
            {project.program ? (
              <ButtonLink href={localePath(locale, `/programs/${project.program.slug}`)} tone="quiet" size="sm">
                {dict.contentUi.toProgram}
              </ButtonLink>
            ) : null}
          </div>
        </aside>
      </article>

      <ProjectsRail
        locale={locale}
        dict={dict}
        projects={related}
        title={dict.contentUi.relatedProjects}
        id="project-related"
        actions={
          project.program ? (
            <ButtonLink
              href={localePath(locale, `/projects?program=${encodeURIComponent(project.program.key)}`)}
              tone="marked"
              size="sm"
            >
              {dict.common.viewAll}
            </ButtonLink>
          ) : null
        }
      />
    </Container>
  );
}
