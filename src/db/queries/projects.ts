import { and, arrayOverlaps, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  mediaAssets,
  partners,
  programs,
  projectMedia,
  projectPartners,
  projects,
} from '@/db/schema';
import type { Governorate, ProjectStatus, ThemeTag } from '@/db/schema/enums';
import { TAGS } from '@/lib/cache/tags';
import type { Locale } from '@/lib/i18n/config';
import { rowsOf } from '@/db/session';
import { cached } from './_cache';
import { hasLocale, pickCol, slugCol } from './_localize';

export const PROJECTS_PER_PAGE = 12;

export type ProjectFilters = {
  program?: string;
  governorates?: Governorate[];
  themes?: ThemeTag[];
  year?: number;
  partnerId?: string;
  state?: ProjectStatus;
  page?: number;
};

export type ProjectCard = {
  id: string;
  slug: string;
  title: string | null;
  summary: string | null;
  state: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  governorates: Governorate[];
  themes: ThemeTag[];
  programKey: string;
  programTitle: string | null;
  heroPath: string | null;
  heroAlt: string | null;
  heroBlur: string | null;
};

function whereFor(filters: ProjectFilters) {
  return and(
    eq(projects.status, 'published'),
    filters.program ? eq(programs.key, filters.program as never) : undefined,
    filters.state ? eq(projects.projectState, filters.state) : undefined,
    // Array overlap, served by the two GIN indexes. A chain of `or(eq(...))`
    // over the same enum arrays would be a sequential scan.
    filters.governorates?.length
      ? arrayOverlaps(projects.governorates, filters.governorates)
      : undefined,
    filters.themes?.length ? arrayOverlaps(projects.themes, filters.themes) : undefined,
    filters.year
      ? and(
          gte(projects.startDate, `${filters.year}-01-01`),
          lte(projects.startDate, `${filters.year}-12-31`),
        )
      : undefined,
    filters.partnerId
      ? sql`exists (select 1 from ${projectPartners} pp
                    where pp.project_id = ${projects.id}
                      and pp.partner_id = ${filters.partnerId})`
      : undefined,
  );
}

export async function _listProjects(locale: Locale, filters: ProjectFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const where = whereFor(filters);

  const [rows, counted] = await Promise.all([
    db
      .select({
        id: projects.id,
        slug: slugCol(projects.slugAr, projects.slugEn, locale),
        title: pickCol(projects.titleAr, projects.titleEn, locale),
        summary: pickCol(projects.summaryAr, projects.summaryEn, locale),
        state: projects.projectState,
        startDate: projects.startDate,
        endDate: projects.endDate,
        governorates: projects.governorates,
        themes: projects.themes,
        programKey: programs.key,
        programTitle: pickCol(programs.titleAr, programs.titleEn, locale),
        heroPath: mediaAssets.path,
        heroAlt: pickCol(mediaAssets.altAr, mediaAssets.altEn, locale),
        heroBlur: mediaAssets.blurDataUrl,
      })
      .from(projects)
      .innerJoin(programs, eq(programs.id, projects.programId))
      .leftJoin(mediaAssets, eq(mediaAssets.id, projects.heroMediaId))
      .where(where)
      .orderBy(desc(projects.publishedAt))
      .limit(PROJECTS_PER_PAGE)
      .offset((page - 1) * PROJECTS_PER_PAGE),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
      .innerJoin(programs, eq(programs.id, projects.programId))
      .where(where),
  ]);

  const total = counted[0]?.count ?? 0;
  return {
    items: rows as ProjectCard[],
    total,
    page,
    perPage: PROJECTS_PER_PAGE,
    totalPages: Math.max(1, Math.ceil(total / PROJECTS_PER_PAGE)),
  };
}

export const listProjects = cached(_listProjects, ['projects:list'], {
  tags: [TAGS.projectList],
});

export async function _getProjectBySlug(slug: string, locale: Locale) {
  const [row] = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.status, 'published'),
        eq(slugCol(projects.slugAr, projects.slugEn, locale), slug),
      ),
    )
    .limit(1);

  if (!row) return null;

  const [program, hero, partnerRows, gallery] = await Promise.all([
    db
      .select({
        key: programs.key,
        slug: slugCol(programs.slugAr, programs.slugEn, locale),
        title: pickCol(programs.titleAr, programs.titleEn, locale),
        accentToken: programs.accentToken,
      })
      .from(programs)
      .where(eq(programs.id, row.programId))
      .limit(1),

    row.heroMediaId
      ? db
          .select({
            path: mediaAssets.path,
            alt: pickCol(mediaAssets.altAr, mediaAssets.altEn, locale),
            blur: mediaAssets.blurDataUrl,
            width: mediaAssets.width,
            height: mediaAssets.height,
          })
          .from(mediaAssets)
          .where(eq(mediaAssets.id, row.heroMediaId))
          .limit(1)
      : Promise.resolve([]),

    db
      .select({
        id: partners.id,
        name: pickCol(partners.nameAr, partners.nameEn, locale),
        role: projectPartners.role,
        website: partners.website,
        // The logo renders only with permission — enforced here, in the query,
        // so no component can accidentally show an unlicensed mark.
        logoPath: sql<
          string | null
        >`case when ${partners.logoPermission} = 'granted' then ${mediaAssets.path} else null end`,
      })
      .from(projectPartners)
      .innerJoin(partners, eq(partners.id, projectPartners.partnerId))
      .leftJoin(mediaAssets, eq(mediaAssets.id, partners.logoMediaId))
      .where(and(eq(projectPartners.projectId, row.id), eq(partners.status, 'published')))
      .orderBy(partners.displayOrder),

    db
      .select({
        path: mediaAssets.path,
        alt: pickCol(mediaAssets.altAr, mediaAssets.altEn, locale),
        caption: pickCol(mediaAssets.captionAr, mediaAssets.captionEn, locale),
        blur: mediaAssets.blurDataUrl,
        width: mediaAssets.width,
        height: mediaAssets.height,
      })
      .from(projectMedia)
      .innerJoin(mediaAssets, eq(mediaAssets.id, projectMedia.mediaId))
      .where(eq(projectMedia.projectId, row.id))
      .orderBy(projectMedia.displayOrder),
  ]);

  return {
    id: row.id,
    slugAr: row.slugAr,
    slugEn: row.slugEn,
    title: locale === 'ar' ? row.titleAr : (row.titleEn?.trim() || row.titleAr),
    summary: locale === 'ar' ? row.summaryAr : (row.summaryEn?.trim() || row.summaryAr),
    objective: locale === 'ar' ? row.objectiveAr : (row.objectiveEn ?? row.objectiveAr),
    activities: locale === 'ar' ? row.activitiesAr : (row.activitiesEn ?? row.activitiesAr),
    outcomes: locale === 'ar' ? row.outcomesAr : (row.outcomesEn ?? row.outcomesAr),
    state: row.projectState,
    startDate: row.startDate,
    endDate: row.endDate,
    governorates: row.governorates,
    localities: row.localities,
    themes: row.themes,
    publishedAt: row.publishedAt,
    isTranslated: hasLocale(row, locale),
    seoTitle: locale === 'ar' ? row.seoTitleAr : (row.seoTitleEn ?? row.seoTitleAr),
    seoDescription:
      locale === 'ar' ? row.seoDescriptionAr : (row.seoDescriptionEn ?? row.seoDescriptionAr),
    noIndex: row.noIndex,
    program: program[0] ?? null,
    hero: hero[0] ?? null,
    implementingPartners: partnerRows.filter((p) => p.role === 'implementing'),
    donors: partnerRows.filter((p) => p.role === 'donor'),
    gallery,
  };
}

export const getProjectBySlug = cached(_getProjectBySlug, ['projects:detail'], {
  tags: [TAGS.projectList],
});

/**
 * Counts per filter option, in one round trip rather than one query per facet.
 *
 * `unnest` on the enum arrays is what makes the governorate and theme counts a
 * single aggregate instead of five and five.
 */
export async function _getProjectFacets() {
  const [byProgram, byGovernorate, byTheme, byYear] = await Promise.all([
    db
      .select({ key: programs.key, count: sql<number>`count(*)::int` })
      .from(projects)
      .innerJoin(programs, eq(programs.id, projects.programId))
      .where(eq(projects.status, 'published'))
      .groupBy(programs.key),

    db.execute(sql`
      select unnest(governorates)::text as key, count(*)::int as count
      from ${projects} where status = 'published' group by 1 order by 2 desc`),

    db.execute(sql`
      select unnest(themes)::text as key, count(*)::int as count
      from ${projects} where status = 'published' group by 1 order by 2 desc`),

    db.execute(sql`
      select extract(year from start_date)::int as key, count(*)::int as count
      from ${projects}
      where status = 'published' and start_date is not null
      group by 1 order by 1 desc`),
  ]);

  return {
    byProgram,
    byGovernorate: rowsOf<{ key: string; count: number }>(byGovernorate),
    byTheme: rowsOf<{ key: string; count: number }>(byTheme),
    byYear: rowsOf<{ key: number; count: number }>(byYear),
  };
}

export const getProjectFacets = cached(_getProjectFacets, ['projects:facets'], {
  tags: [TAGS.projectList],
});

/** Slugs for `generateStaticParams`. Both locales, published only. */
export async function _listProjectSlugs() {
  return db
    .select({
      slugAr: projects.slugAr,
      slugEn: projects.slugEn,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.status, 'published'));
}

export const listProjectSlugs = cached(_listProjectSlugs, ['projects:slugs'], {
  tags: [TAGS.projectList],
});
