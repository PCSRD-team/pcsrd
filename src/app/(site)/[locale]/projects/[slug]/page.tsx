import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RichText } from '@/components/content/rich-text';
import { DateText } from '@/components/ui/bidi';
import { Badge, DefinitionList, Panel, Prose, Section, SectionHeading } from '@/components/ui/primitives';
import { UntranslatedNotice } from '@/components/ui/states';
import { getProjectBySlug, listProjectSlugs } from '@/db/queries/projects';
import { publicEnv } from '@/lib/env.public';
import { formatPeriod, storageUrl } from '@/lib/format';
import { LOCALES, isLocale, localePath } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { prerenderData } from '@/lib/build-time';

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await prerenderData('project slugs', () => listProjectSlugs(), []);
  return LOCALES.flatMap((locale) =>
    slugs.map((row) => ({ locale, slug: locale === 'ar' ? row.slugAr : row.slugEn })),
  );
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/projects/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const project = await getProjectBySlug(slug, locale);
  if (!project) return {};

  return {
    title: project.seoTitle ?? project.title ?? undefined,
    description: project.seoDescription ?? project.summary ?? undefined,
    robots: project.noIndex ? { index: false, follow: false } : undefined,
    alternates: {
      canonical: `/${locale}/projects/${slug}`,
      languages: {
        ar: `/ar/projects/${project.slugAr}`,
        en: `/en/projects/${project.slugEn}`,
      },
    },
  };
}

const STATE_TONE = { active: 'active', completed: 'complete', planned: 'planned' } as const;

export default async function ProjectPage({ params }: PageProps<'/[locale]/projects/[slug]'>) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, project] = await Promise.all([
    getDictionary(locale),
    getProjectBySlug(slug, locale),
  ]);
  if (!project) notFound();

  const stateLabel = {
    planned: dict.projects.statePlanned,
    active: dict.projects.stateActive,
    completed: dict.projects.stateCompleted,
  }[project.state];

  const govLabel = (key: string) =>
    (dict.enums.governorate as Record<string, string>)[key] ?? key;
  const themeLabel = (key: string) => (dict.enums.theme as Record<string, string>)[key] ?? key;

  return (
    <div className="container-content section-gap">
      {!project.isTranslated ? (
        <UntranslatedNotice
          title={dict.states.untranslatedTitle}
          body={dict.states.untranslatedBody}
        />
      ) : null}

      {project.program ? (
        <p className="eyebrow mbe-4">
          <Link href={localePath(locale, `/programs/${project.program.slug}`)}>
            {project.program.title}
          </Link>
        </p>
      ) : null}

      <h1 className="text-h1 font-semibold text-ink">{project.title}</h1>
      <span className="rule-mark mbs-5 block" aria-hidden="true" />

      {project.summary ? (
        <p className="measure-lead mbs-6 text-lead text-ink-70">{project.summary}</p>
      ) : null}

      {project.hero ? (
        <div className="mbs-10 relative aspect-[16/9] overflow-hidden bg-paper-alt">
          <Image
            src={storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, 'media', project.hero.path)}
            alt={project.hero.alt ?? ''}
            fill
            sizes="(min-width: 1180px) 1180px, 100vw"
            placeholder={project.hero.blur ? 'blur' : 'empty'}
            blurDataURL={project.hero.blur ?? undefined}
            className="object-cover"
            // `priority` was deprecated in Next 16; `preload` says what it does.
            preload
          />
        </div>
      ) : null}

      {/* The record: period, status, locations, partners. This is what a
          due-diligence reader came for, so it sits above the narrative. */}
      <Section labelledBy="project-record">
        <SectionHeading id="project-record" title={dict.about.identity} />
        <Panel>
          <DefinitionList
            items={[
              { term: dict.projects.state, value: <Badge tone={STATE_TONE[project.state]}>{stateLabel}</Badge> },
              {
                term: dict.projects.period,
                value: formatPeriod(project.startDate, project.endDate, locale) ? (
                  <DateText locale={locale}>{formatPeriod(project.startDate, project.endDate, locale)}</DateText>
                ) : null,
              },
              {
                term: dict.projects.locations,
                value:
                  project.governorates.length || project.localities.length
                    ? [...project.governorates.map(govLabel), ...project.localities].join('، ')
                    : null,
              },
              {
                term: dict.projects.theme,
                value: project.themes.length ? project.themes.map(themeLabel).join('، ') : null,
              },
              {
                term: dict.projects.implementingPartners,
                value: project.implementingPartners.length
                  ? project.implementingPartners.map((p) => p.name).join('، ')
                  : null,
              },
              {
                term: dict.projects.donors,
                value: project.donors.length
                  ? project.donors.map((p) => p.name).join('، ')
                  : null,
              },
            ]}
          />
        </Panel>
      </Section>

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
          <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {project.gallery.map((item) => (
              <li key={item.path}>
                <figure>
                  <div className="relative aspect-[4/3] overflow-hidden bg-paper-alt">
                    <Image
                      src={storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, 'media', item.path)}
                      alt={item.alt ?? ''}
                      fill
                      sizes="(min-width: 768px) 380px, 100vw"
                      placeholder={item.blur ? 'blur' : 'empty'}
                      blurDataURL={item.blur ?? undefined}
                      className="object-cover"
                    />
                  </div>
                  {item.caption ? (
                    <figcaption className="mbs-2 text-caption text-ink-55">
                      {item.caption}
                    </figcaption>
                  ) : null}
                </figure>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
