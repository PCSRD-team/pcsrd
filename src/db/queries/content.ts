import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import {
  impactMetrics,
  mediaAssets,
  organizationSettings,
  pages,
  partners,
  people,
  posts,
  programs,
  projects,
  publications,
  stories,
  vacancies,
} from '@/db/schema';
import type { PostCategory, VacancyType } from '@/db/schema/enums';
import { TAGS, detailTags } from '@/lib/cache/tags';
import type { Locale } from '@/lib/i18n/config';
import { cached } from './_cache';
import {
  developmentOrganization,
  shouldUseDevelopmentDatabaseFallback,
  shouldUseDevelopmentPlaceholderData,
} from './_dev-fallback';
import { hasLocale, pickCol, slugCol } from './_localize';

/**
 * Public reads for everything except projects, which has its own module
 * because of its facets and its two junction tables.
 *
 * Every function here filters `status = 'published'`, takes an explicit
 * `locale`, and returns locale-resolved fields. Each is exported twice: the
 * underscore-prefixed raw version for tests and scripts, and the cached one for
 * pages.
 */

const hero = {
  heroPath: mediaAssets.path,
  heroBlur: mediaAssets.blurDataUrl,
};
const footerLogoMedia = alias(mediaAssets, 'footer_logo_media');

// ── Organisation ─────────────────────────────────────────────────────────

export async function _getOrganization(locale: Locale) {
  if (shouldUseDevelopmentPlaceholderData()) return developmentOrganization(locale);

  let row;
  try {
    [row] = await db
      .select({
        id: organizationSettings.id,
        legalNameAr: organizationSettings.legalNameAr,
        legalNameEn: organizationSettings.legalNameEn,
        shortNameAr: organizationSettings.shortNameAr,
        shortNameEn: organizationSettings.shortNameEn,
        acronym: organizationSettings.acronym,
        shortDescriptionAr: organizationSettings.shortDescriptionAr,
        shortDescriptionEn: organizationSettings.shortDescriptionEn,
        alternateNames: organizationSettings.alternateNames,
        foundedYear: organizationSettings.foundedYear,
        licenseNumber: organizationSettings.licenseNumber,
        licenseAuthorityAr: organizationSettings.licenseAuthorityAr,
        licenseAuthorityEn: organizationSettings.licenseAuthorityEn,
        legalFormAr: organizationSettings.legalFormAr,
        legalFormEn: organizationSettings.legalFormEn,
        visionAr: organizationSettings.visionAr,
        visionEn: organizationSettings.visionEn,
        missionAr: organizationSettings.missionAr,
        missionEn: organizationSettings.missionEn,
        coreValues: organizationSettings.coreValues,
        principles: organizationSettings.principles,
        strategicObjectives: organizationSettings.strategicObjectives,
        primaryPhone: organizationSettings.primaryPhone,
        additionalPhones: organizationSettings.additionalPhones,
        whatsappNumber: organizationSettings.whatsappNumber,
        email: organizationSettings.email,
        secondaryEmail: organizationSettings.secondaryEmail,
        addressAr: organizationSettings.addressAr,
        addressEn: organizationSettings.addressEn,
        addressIsPublic: organizationSettings.addressIsPublic,
        officeHoursAr: organizationSettings.officeHoursAr,
        officeHoursEn: organizationSettings.officeHoursEn,
        socials: organizationSettings.socials,
        officialChannels: organizationSettings.officialChannels,
        footerCtaTitleAr: organizationSettings.footerCtaTitleAr,
        footerCtaTitleEn: organizationSettings.footerCtaTitleEn,
        footerCtaDescriptionAr: organizationSettings.footerCtaDescriptionAr,
        footerCtaDescriptionEn: organizationSettings.footerCtaDescriptionEn,
        footerCtaButtonLabelAr: organizationSettings.footerCtaButtonLabelAr,
        footerCtaButtonLabelEn: organizationSettings.footerCtaButtonLabelEn,
        footerCtaUrl: organizationSettings.footerCtaUrl,
        footerCtaEnabled: organizationSettings.footerCtaEnabled,
        footerCtaFieldsAvailable: sql<boolean>`true`,
        logoPrimaryId: organizationSettings.logoPrimaryId,
        footerLogoId: organizationSettings.footerLogoId,
        logoMonoId: organizationSettings.logoMonoId,
        defaultOgId: organizationSettings.defaultOgId,
        logoPrimaryBucket: mediaAssets.bucket,
        logoPrimaryPath: mediaAssets.path,
        logoPrimaryAlt: pickCol(mediaAssets.altAr, mediaAssets.altEn, locale),
        footerLogoBucket: footerLogoMedia.bucket,
        footerLogoPath: footerLogoMedia.path,
        footerLogoAltAr: footerLogoMedia.altAr,
        footerLogoAltEn: footerLogoMedia.altEn,
        updatedAt: organizationSettings.updatedAt,
        updatedBy: organizationSettings.updatedBy,
      })
      .from(organizationSettings)
      .leftJoin(mediaAssets, eq(mediaAssets.id, organizationSettings.logoPrimaryId))
      .leftJoin(footerLogoMedia, eq(footerLogoMedia.id, organizationSettings.footerLogoId))
      .where(eq(organizationSettings.id, true))
      .limit(1);
  } catch (error) {
    if (shouldUseDevelopmentDatabaseFallback(error)) return developmentOrganization(locale);
    throw error;
  }
  if (!row) return null;

  const en = locale === 'en';
  return {
    ...row,
    legalName: en ? row.legalNameEn : row.legalNameAr,
    shortName: en ? row.shortNameEn : row.shortNameAr,
    shortDescription: en
      ? (row.shortDescriptionEn ?? row.shortDescriptionAr)
      : row.shortDescriptionAr,
    vision: en ? (row.visionEn ?? row.visionAr) : row.visionAr,
    mission: en ? (row.missionEn ?? row.missionAr) : row.missionAr,
    licenseAuthority: en
      ? (row.licenseAuthorityEn ?? row.licenseAuthorityAr)
      : row.licenseAuthorityAr,
    legalForm: en ? (row.legalFormEn ?? row.legalFormAr) : row.legalFormAr,
    officeHours: en ? (row.officeHoursEn ?? row.officeHoursAr) : row.officeHoursAr,
    footerCta: {
      enabled: row.footerCtaEnabled,
      fieldsAvailable: row.footerCtaFieldsAvailable,
      title: en ? (row.footerCtaTitleEn ?? row.footerCtaTitleAr) : row.footerCtaTitleAr,
      description: en
        ? (row.footerCtaDescriptionEn ?? row.footerCtaDescriptionAr)
        : row.footerCtaDescriptionAr,
      buttonLabel: en
        ? (row.footerCtaButtonLabelEn ?? row.footerCtaButtonLabelAr)
        : row.footerCtaButtonLabelAr,
      url: row.footerCtaUrl,
    },
    footerLogoBucket: row.footerLogoBucket ?? row.logoPrimaryBucket,
    footerLogoPath: row.footerLogoPath ?? row.logoPrimaryPath,
    footerLogoAlt: en
      ? (row.footerLogoAltEn ?? row.footerLogoAltAr ?? row.logoPrimaryAlt)
      : (row.footerLogoAltAr ?? row.logoPrimaryAlt),
    // DNH-6: the address is rendered only when the organisation opted in.
    address: row.addressIsPublic ? (en ? (row.addressEn ?? row.addressAr) : row.addressAr) : null,
  };
}

export const getOrganization = cached(_getOrganization, ['org:settings'], {
  tags: [TAGS.orgSettings],
});

// ── Programmes ───────────────────────────────────────────────────────────

export async function _listPrograms(locale: Locale) {
  if (shouldUseDevelopmentPlaceholderData()) return [];

  try {
    return await db
      .select({
        id: programs.id,
        key: programs.key,
        slug: slugCol(programs.slugAr, programs.slugEn, locale),
        title: pickCol(programs.titleAr, programs.titleEn, locale),
        tagline: pickCol(programs.taglineAr, programs.taglineEn, locale),
        accentToken: programs.accentToken,
        targetGroups: programs.targetGroups,
        ...hero,
        heroAlt: pickCol(mediaAssets.altAr, mediaAssets.altEn, locale),
      })
      .from(programs)
      .leftJoin(mediaAssets, eq(mediaAssets.id, programs.heroMediaId))
      .where(eq(programs.status, 'published'))
      .orderBy(asc(programs.displayOrder));
  } catch (error) {
    if (shouldUseDevelopmentDatabaseFallback(error)) return [];
    throw error;
  }
}

export const listPrograms = cached(_listPrograms, ['programs:list'], {
  tags: [TAGS.programList],
});

export async function _getProgramBySlug(slug: string, locale: Locale) {
  const [row] = await db
    .select()
    .from(programs)
    .where(
      and(
        eq(programs.status, 'published'),
        eq(slugCol(programs.slugAr, programs.slugEn, locale), slug),
      ),
    )
    .limit(1);
  if (!row) return null;

  const en = locale === 'en';
  const [heroRow, projectCount] = await Promise.all([
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
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
      .where(and(eq(projects.programId, row.id), eq(projects.status, 'published'))),
  ]);

  return {
    ...row,
    title: en ? (row.titleEn?.trim() || row.titleAr) : row.titleAr,
    tagline: en ? (row.taglineEn?.trim() || row.taglineAr) : row.taglineAr,
    introduction: en ? (row.introductionEn ?? row.introductionAr) : row.introductionAr,
    rationale: en ? (row.rationaleEn ?? row.rationaleAr) : row.rationaleAr,
    strategicObjective: en
      ? (row.strategicObjectiveEn?.trim() || row.strategicObjectiveAr)
      : row.strategicObjectiveAr,
    sustainability: en ? (row.sustainabilityEn ?? row.sustainabilityAr) : row.sustainabilityAr,
    impactStatement: en
      ? (row.impactStatementEn ?? row.impactStatementAr)
      : row.impactStatementAr,
    eligibility: en ? (row.eligibilityEn ?? row.eligibilityAr) : row.eligibilityAr,
    howToAccess: en ? (row.howToAccessEn ?? row.howToAccessAr) : row.howToAccessAr,
    isTranslated: hasLocale(row, locale),
    hero: heroRow[0] ?? null,
    projectCount: projectCount[0]?.count ?? 0,
  };
}

export const getProgramBySlug = cached(_getProgramBySlug, ['programs:detail'], {
  tags: (slug) => detailTags('program', slug),
});

/** Slugs for `generateStaticParams` and the sitemap. Both locales, published only. */
export async function _listProgramSlugs() {
  return db
    .select({
      slugAr: programs.slugAr,
      slugEn: programs.slugEn,
      translationStatus: programs.translationStatus,
      updatedAt: programs.updatedAt,
      publishedAt: programs.publishedAt,
    })
    .from(programs)
    .where(eq(programs.status, 'published'))
    .orderBy(asc(programs.displayOrder));
}

export const listProgramSlugs = cached(_listProgramSlugs, ['programs:slugs'], {
  tags: [TAGS.programList],
});

// ── Posts ────────────────────────────────────────────────────────────────

export const POSTS_PER_PAGE = 12;

export async function _listPosts(
  locale: Locale,
  options: { category?: PostCategory; page?: number; limit?: number } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const perPage = options.limit ?? POSTS_PER_PAGE;
  if (shouldUseDevelopmentPlaceholderData()) {
    return { items: [], total: 0, page, perPage, totalPages: 1 };
  }

  const where = and(
    eq(posts.status, 'published'),
    options.category ? eq(posts.category, options.category) : undefined,
  );

  let rows;
  let counted;
  try {
    [rows, counted] = await Promise.all([
      db
        .select({
          id: posts.id,
          slug: slugCol(posts.slugAr, posts.slugEn, locale),
          category: posts.category,
          title: pickCol(posts.titleAr, posts.titleEn, locale),
          excerpt: pickCol(posts.excerptAr, posts.excerptEn, locale),
          publishedAt: posts.publishedAt,
          heroMediaId: posts.heroMediaId,
        })
        .from(posts)
        .where(where)
        .orderBy(desc(posts.publishedAt))
        .limit(perPage)
        .offset((page - 1) * perPage),
      db.select({ count: sql<number>`count(*)::int` }).from(posts).where(where),
    ]);
  } catch (error) {
    if (shouldUseDevelopmentDatabaseFallback(error)) {
      return { items: [], total: 0, page, perPage, totalPages: 1 };
    }
    throw error;
  }

  const total = counted[0]?.count ?? 0;
  const heroIds = Array.from(
    new Set(rows.map((row) => row.heroMediaId).filter((id): id is string => Boolean(id))),
  );
  const heroRows =
    heroIds.length > 0
      ? await db
          .select({
            id: mediaAssets.id,
            heroPath: mediaAssets.path,
            heroBlur: mediaAssets.blurDataUrl,
            heroAlt: pickCol(mediaAssets.altAr, mediaAssets.altEn, locale),
          })
          .from(mediaAssets)
          .where(inArray(mediaAssets.id, heroIds))
      : [];
  const mediaById = new Map(heroRows.map((row) => [row.id, row]));
  const items = rows.map(({ heroMediaId, ...row }) => {
    const media = heroMediaId ? mediaById.get(heroMediaId) : null;
    return {
      ...row,
      heroPath: media?.heroPath ?? null,
      heroBlur: media?.heroBlur ?? null,
      heroAlt: media?.heroAlt ?? null,
    };
  });

  return { items, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

export const listPosts = cached(_listPosts, ['posts:list'], { tags: [TAGS.postList] });

/** Slugs for `generateStaticParams` and the sitemap. Both locales, published only. */
export async function _listPostSlugs() {
  return db
    .select({
      slugAr: posts.slugAr,
      slugEn: posts.slugEn,
      translationStatus: posts.translationStatus,
      updatedAt: posts.updatedAt,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .where(eq(posts.status, 'published'))
    .orderBy(desc(posts.publishedAt));
}

export const listPostSlugs = cached(_listPostSlugs, ['posts:slugs'], {
  tags: [TAGS.postList],
});

export async function _getPostBySlug(slug: string, locale: Locale) {
  const [row] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.status, 'published'), eq(slugCol(posts.slugAr, posts.slugEn, locale), slug)))
    .limit(1);
  if (!row) return null;

  const en = locale === 'en';
  const heroRow = row.heroMediaId
    ? await db
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
    : [];

  return {
    ...row,
    title: en ? (row.titleEn?.trim() || row.titleAr) : row.titleAr,
    excerpt: en ? (row.excerptEn?.trim() || row.excerptAr) : row.excerptAr,
    body: en ? (row.bodyEn ?? row.bodyAr) : row.bodyAr,
    isTranslated: hasLocale(row, locale),
    hero: heroRow[0] ?? null,
  };
}

export const getPostBySlug = cached(_getPostBySlug, ['posts:detail'], {
  tags: (slug) => detailTags('post', slug),
});

// ── Stories ──────────────────────────────────────────────────────────────

export async function _listStories(
  locale: Locale,
  options: { limit?: number; featuredOnly?: boolean } = {},
) {
  try {
    return await db
      .select({
        id: stories.id,
        slug: slugCol(stories.slugAr, stories.slugEn, locale),
        title: pickCol(stories.titleAr, stories.titleEn, locale),
        summary: pickCol(stories.summaryAr, stories.summaryEn, locale),
        quote: pickCol(stories.quoteTextAr, stories.quoteTextEn, locale),
        quoteAttribution: pickCol(
          stories.quoteAttributionAr,
          stories.quoteAttributionEn,
          locale,
        ),
        publishedAt: stories.publishedAt,
        ...hero,
        heroAlt: pickCol(mediaAssets.altAr, mediaAssets.altEn, locale),
      })
      .from(stories)
      .leftJoin(mediaAssets, eq(mediaAssets.id, stories.heroMediaId))
      .where(
        and(
          eq(stories.status, 'published'),
          options.featuredOnly ? eq(stories.isFeatured, true) : undefined,
        ),
      )
      .orderBy(desc(stories.publishedAt))
      .limit(options.limit ?? 24);
  } catch (error) {
    if (shouldUseDevelopmentDatabaseFallback(error)) return [];
    throw error;
  }
}

export const listStories = cached(_listStories, ['stories:list'], { tags: [TAGS.storyList] });

/** Slugs for `generateStaticParams` and the sitemap. Both locales, published only. */
export async function _listStorySlugs() {
  return db
    .select({
      slugAr: stories.slugAr,
      slugEn: stories.slugEn,
      translationStatus: stories.translationStatus,
      updatedAt: stories.updatedAt,
      publishedAt: stories.publishedAt,
    })
    .from(stories)
    .where(eq(stories.status, 'published'))
    .orderBy(desc(stories.publishedAt));
}

export const listStorySlugs = cached(_listStorySlugs, ['stories:slugs'], {
  tags: [TAGS.storyList],
});

export async function _getStoryBySlug(slug: string, locale: Locale) {
  const [row] = await db
    .select()
    .from(stories)
    .where(
      and(eq(stories.status, 'published'), eq(slugCol(stories.slugAr, stories.slugEn, locale), slug)),
    )
    .limit(1);
  if (!row) return null;

  const en = locale === 'en';
  return {
    ...row,
    title: en ? (row.titleEn?.trim() || row.titleAr) : row.titleAr,
    summary: en ? (row.summaryEn?.trim() || row.summaryAr) : row.summaryAr,
    body: en ? (row.bodyEn ?? row.bodyAr) : row.bodyAr,
    quote: en ? (row.quoteTextEn?.trim() || row.quoteTextAr) : row.quoteTextAr,
    quoteAttribution: en
      ? (row.quoteAttributionEn?.trim() || row.quoteAttributionAr)
      : row.quoteAttributionAr,
    isTranslated: hasLocale(row, locale),
  };
}

export const getStoryBySlug = cached(_getStoryBySlug, ['stories:detail'], {
  tags: (slug) => detailTags('story', slug),
});

// ── Vacancies ────────────────────────────────────────────────────────────

/**
 * Open positions only.
 *
 * The deadline filter is applied in the query rather than left to the archive
 * cron: a job that closed at midnight must stop appearing immediately, not at
 * the next cron tick.
 */
export async function _listOpenVacancies(locale: Locale, options: { type?: VacancyType } = {}) {
  return db
    .select({
      id: vacancies.id,
      slug: slugCol(vacancies.slugAr, vacancies.slugEn, locale),
      type: vacancies.type,
      title: pickCol(vacancies.titleAr, vacancies.titleEn, locale),
      location: pickCol(vacancies.locationAr, vacancies.locationEn, locale),
      employmentType: vacancies.employmentType,
      deadline: vacancies.deadline,
      postedAt: vacancies.postedAt,
      applicationMethod: vacancies.applicationMethod,
    })
    .from(vacancies)
    .where(
      and(
        eq(vacancies.status, 'published'),
        gte(vacancies.deadline, sql`current_date`),
        options.type ? eq(vacancies.type, options.type) : undefined,
      ),
    )
    .orderBy(asc(vacancies.deadline));
}

export const listOpenVacancies = cached(_listOpenVacancies, ['vacancies:open'], {
  tags: [TAGS.vacancyList],
});

/**
 * Slugs for `generateStaticParams` and the sitemap. Closed vacancies stay
 * reachable (an applicant's bookmark must not 404), so `deadline` is returned
 * and the sitemap — which should only advertise open positions — filters on it.
 */
export async function _listVacancySlugs() {
  return db
    .select({
      slugAr: vacancies.slugAr,
      slugEn: vacancies.slugEn,
      translationStatus: vacancies.translationStatus,
      deadline: vacancies.deadline,
      updatedAt: vacancies.updatedAt,
      publishedAt: vacancies.publishedAt,
    })
    .from(vacancies)
    .where(eq(vacancies.status, 'published'))
    .orderBy(asc(vacancies.deadline));
}

export const listVacancySlugs = cached(_listVacancySlugs, ['vacancies:slugs'], {
  tags: [TAGS.vacancyList],
});

export async function _getVacancyBySlug(slug: string, locale: Locale) {
  const [row] = await db
    .select()
    .from(vacancies)
    .where(
      and(
        eq(vacancies.status, 'published'),
        eq(slugCol(vacancies.slugAr, vacancies.slugEn, locale), slug),
      ),
    )
    .limit(1);
  if (!row) return null;

  const en = locale === 'en';
  return {
    ...row,
    title: en ? (row.titleEn?.trim() || row.titleAr) : row.titleAr,
    location: en ? (row.locationEn?.trim() || row.locationAr) : row.locationAr,
    description: en ? (row.descriptionEn ?? row.descriptionAr) : row.descriptionAr,
    requirements: en ? (row.requirementsEn ?? row.requirementsAr) : row.requirementsAr,
    isTranslated: hasLocale(row, locale),
    /** Computed here so no component has to reason about dates. */
    isClosed: row.deadline < new Date().toISOString().slice(0, 10),
  };
}

export const getVacancyBySlug = cached(_getVacancyBySlug, ['vacancies:detail'], {
  tags: (slug) => detailTags('vacancy', slug),
});

// ── Publications ─────────────────────────────────────────────────────────

export async function _listPublications(locale: Locale) {
  return db
    .select({
      id: publications.id,
      slug: slugCol(publications.slugAr, publications.slugEn, locale),
      type: publications.type,
      title: pickCol(publications.titleAr, publications.titleEn, locale),
      description: pickCol(publications.descriptionAr, publications.descriptionEn, locale),
      publishedYear: publications.publishedYear,
      // The Arabic file is the fallback: an English reader is better served by
      // the Arabic report than by a missing link.
      filePath: mediaAssets.path,
      fileSize: mediaAssets.fileSize,
    })
    .from(publications)
    .leftJoin(
      mediaAssets,
      eq(mediaAssets.id, locale === 'en' ? publications.fileEnId : publications.fileArId),
    )
    .where(eq(publications.status, 'published'))
    .orderBy(asc(publications.displayOrder), desc(publications.publishedYear));
}

export const listPublications = cached(_listPublications, ['publications:list'], {
  tags: [TAGS.publicationList],
});

// ── Partners ─────────────────────────────────────────────────────────────

export async function _listPartners(locale: Locale) {
  if (shouldUseDevelopmentPlaceholderData()) return [];

  try {
    return await db
      .select({
        id: partners.id,
        name: pickCol(partners.nameAr, partners.nameEn, locale),
        type: partners.type,
        membershipLevel: partners.membershipLevel,
        sector: pickCol(partners.sectorAr, partners.sectorEn, locale),
        description: pickCol(partners.descriptionAr, partners.descriptionEn, locale),
        website: partners.website,
        isFeatured: partners.isFeatured,
        // The logo gate lives in the query, not the component (02-API §4.5).
        logoPath: sql<
          string | null
        >`case when ${partners.logoPermission} = 'granted' then ${mediaAssets.path} else null end`,
        logoAlt: pickCol(mediaAssets.altAr, mediaAssets.altEn, locale),
      })
      .from(partners)
      .leftJoin(mediaAssets, eq(mediaAssets.id, partners.logoMediaId))
      .where(eq(partners.status, 'published'))
      .orderBy(asc(partners.displayOrder));
  } catch (error) {
    if (shouldUseDevelopmentDatabaseFallback(error)) return [];
    throw error;
  }
}

export const listPartners = cached(_listPartners, ['partners:list'], {
  tags: [TAGS.partnerList],
});

// ── Impact metrics ───────────────────────────────────────────────────────

export async function _listMetrics(
  locale: Locale,
  options: { status?: 'verified' | 'target'; programKey?: string; featuredOnly?: boolean } = {},
) {
  if (shouldUseDevelopmentPlaceholderData()) return [];

  try {
    return await db
      .select({
        id: impactMetrics.id,
        label: pickCol(impactMetrics.labelAr, impactMetrics.labelEn, locale),
        value: impactMetrics.value,
        unit: impactMetrics.unit,
        displayPrefix: impactMetrics.displayPrefix,
        periodStart: impactMetrics.periodStart,
        periodEnd: impactMetrics.periodEnd,
        status: impactMetrics.status,
        verificationSource: impactMetrics.verificationSource,
        programKey: programs.key,
      })
      .from(impactMetrics)
      .leftJoin(programs, eq(programs.id, impactMetrics.programId))
      .where(
        and(
          eq(impactMetrics.isPublic, true),
          eq(impactMetrics.status, options.status ?? 'verified'),
          options.featuredOnly ? eq(impactMetrics.isFeatured, true) : undefined,
          options.programKey ? eq(programs.key, options.programKey as never) : undefined,
        ),
      )
      .orderBy(asc(impactMetrics.displayOrder));
  } catch (error) {
    if (shouldUseDevelopmentDatabaseFallback(error)) return [];
    throw error;
  }
}

export const listMetrics = cached(_listMetrics, ['metrics:list'], { tags: [TAGS.metricList] });

// ── People ───────────────────────────────────────────────────────────────

export async function _listPeople(locale: Locale) {
  return db
    .select({
      id: people.id,
      name: pickCol(people.nameAr, people.nameEn, locale),
      role: pickCol(people.roleAr, people.roleEn, locale),
      category: people.category,
      bio: pickCol(people.bioAr, people.bioEn, locale),
      photoPath: mediaAssets.path,
      photoAlt: pickCol(mediaAssets.altAr, mediaAssets.altEn, locale),
      photoBlur: mediaAssets.blurDataUrl,
    })
    .from(people)
    .leftJoin(mediaAssets, eq(mediaAssets.id, people.photoMediaId))
    // DNH-5: opt-in. A person absent from this list is absent from the site.
    .where(eq(people.isPublic, true))
    .orderBy(asc(people.category), asc(people.displayOrder));
}

export const listPeople = cached(_listPeople, ['people:list'], { tags: [TAGS.personList] });

// ── Generic pages ────────────────────────────────────────────────────────

export async function _getPageByKey(key: string, locale: Locale) {
  const [row] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.key, key), eq(pages.status, 'published')))
    .limit(1);
  if (!row) return null;

  const en = locale === 'en';
  return {
    ...row,
    title: en ? (row.titleEn?.trim() || row.titleAr) : row.titleAr,
    body: en ? (row.bodyEn ?? row.bodyAr) : row.bodyAr,
    isTranslated: hasLocale(row, locale),
  };
}

export const getPageByKey = cached(_getPageByKey, ['pages:detail'], {
  tags: (key) => detailTags('page', key),
});

/**
 * Published page keys for the sitemap. The legal route addresses a page by
 * its `key`, so that — not the slug — is what a URL needs.
 */
export async function _listPageKeys() {
  return db
    .select({
      key: pages.key,
      translationStatus: pages.translationStatus,
      updatedAt: pages.updatedAt,
      publishedAt: pages.publishedAt,
    })
    .from(pages)
    .where(eq(pages.status, 'published'));
}

export const listPageKeys = cached(_listPageKeys, ['pages:keys'], { tags: [TAGS.pageList] });

// ── Open Graph media ─────────────────────────────────────────────────────

/**
 * The editor-chosen card image for a record (`og_media_id`, BLOCK C).
 *
 * Read by the per-template `opengraph-image.tsx` routes: when a record has
 * one, the route serves it instead of rendering the default card. Selected
 * here rather than joined into every detail query because only the image
 * route needs it.
 */
export async function _getOgMedia(mediaId: string) {
  const [row] = await db
    .select({
      bucket: mediaAssets.bucket,
      path: mediaAssets.path,
      mimeType: mediaAssets.mimeType,
      width: mediaAssets.width,
      height: mediaAssets.height,
      altAr: mediaAssets.altAr,
      altEn: mediaAssets.altEn,
    })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, mediaId))
    .limit(1);
  return row ?? null;
}

export const getOgMedia = cached(_getOgMedia, ['media:og'], { tags: [TAGS.mediaList] });

// ── Feed ─────────────────────────────────────────────────────────────────

/** Latest published posts for `/feed.xml`. Arabic, newest first. */
export async function _listFeedPosts(limit = 20) {
  return db
    .select({
      slugAr: posts.slugAr,
      title: posts.titleAr,
      excerpt: posts.excerptAr,
      publishedAt: posts.publishedAt,
      category: posts.category,
    })
    .from(posts)
    .where(and(eq(posts.status, 'published'), isNotNull(posts.publishedAt)))
    .orderBy(desc(posts.publishedAt))
    .limit(limit);
}

export const listFeedPosts = cached(_listFeedPosts, ['posts:feed'], { tags: [TAGS.postList] });
