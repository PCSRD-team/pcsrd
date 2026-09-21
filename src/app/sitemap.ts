import type { MetadataRoute } from 'next';
import {
  listPageKeys,
  listPostSlugs,
  listProgramSlugs,
  listStorySlugs,
  listVacancySlugs,
} from '@/db/queries/content';
import { listProjectSlugs } from '@/db/queries/projects';
import { publicEnv } from '@/lib/env.public';
import { prerenderData } from '@/lib/build-time';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/i18n/config';

/**
 * The sitemap.
 *
 * One `<url>` per locale per page — the English URL is a page in its own
 * right, not an alternate of the Arabic one (SEO-021). Every entry carries
 * `alternates.languages` with both locales **and `x-default`** pointing at
 * the Arabic URL (SEO-002): the two locales are separate URLs for the same
 * content and a crawler that cannot see the pairing treats the English page
 * as thin duplicate content.
 *
 * A record with `translation_status = 'ar_only'` gets only its Arabic URL.
 * Its English URL exists (it renders the Arabic body inside a notice) but is
 * `noindex` and canonicalises to the Arabic page, so advertising it here
 * would contradict the page's own metadata (SEO-003 / NEXT-011).
 *
 * Publications have no page of their own — the resources list is entered
 * once. `#fragment` URLs normalise to duplicates of the list and were only
 * ever noise (SEO-020).
 *
 * Only published rows appear — the queries already filter, and RLS refuses the
 * rest to the anonymous identity this build runs as.
 */
export const revalidate = 3600;

const BASE = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');

type Entry = MetadataRoute.Sitemap[number];
type ChangeFrequency = NonNullable<Entry['changeFrequency']>;

/** Locale-less paths that always exist, with how often they are expected to change. */
const STATIC_PATHS: { path: string; changeFrequency: ChangeFrequency; priority: number }[] = [
  { path: '', changeFrequency: 'weekly', priority: 1 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/programs', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/projects', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/impact', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/news', changeFrequency: 'daily', priority: 0.8 },
  { path: '/partners', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/resources', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/careers', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/verify', changeFrequency: 'yearly', priority: 0.7 },
  { path: '/get-involved/partner', changeFrequency: 'yearly', priority: 0.6 },
  { path: '/get-involved/volunteer', changeFrequency: 'yearly', priority: 0.6 },
];

/** A record's path in each locale. A translated record has two; an `ar_only` one has only Arabic. */
type LocalizedPaths = Partial<Record<Locale, string>> & { ar: string };

function entriesFor(
  paths: LocalizedPaths,
  options: { lastModified?: Date | null; changeFrequency?: ChangeFrequency; priority?: number } = {},
): Entry[] {
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) {
    const path = paths[locale];
    if (path !== undefined) languages[locale] = `${BASE}/${locale}${path}`;
  }
  languages['x-default'] = `${BASE}/${DEFAULT_LOCALE}${paths[DEFAULT_LOCALE]}`;

  return LOCALES.flatMap((locale) => {
    const path = paths[locale];
    if (path === undefined) return [];
    return [
      {
        url: `${BASE}/${locale}${path}`,
        lastModified: options.lastModified ?? undefined,
        changeFrequency: options.changeFrequency,
        priority: options.priority,
        alternates: { languages },
      },
    ];
  });
}

/**
 * `updatedAt` and `publishedAt` are `Date | string` because every query feeding
 * this file is `unstable_cache`-wrapped, and the cache stores its value as
 * JSON: a hit returns an ISO string, a miss the real `Date`. See `Serialized`
 * in `src/db/queries/_cache.ts`.
 */
type SluggedRow = {
  slugAr: string;
  slugEn: string;
  translationStatus: string;
  updatedAt: Date | string;
  publishedAt: Date | string | null;
};

function recordPaths(prefix: string, row: SluggedRow): LocalizedPaths {
  return row.translationStatus === 'ar_only'
    ? { ar: `${prefix}/${row.slugAr}` }
    : { ar: `${prefix}/${row.slugAr}`, en: `${prefix}/${row.slugEn}` };
}

/** `updated_at` is the honest signal; `published_at` only when nothing was edited since. */
const lastModified = (row: {
  updatedAt: Date | string;
  publishedAt: Date | string | null;
}): Date => {
  const updated = new Date(row.updatedAt);
  const published = row.publishedAt ? new Date(row.publishedAt) : null;
  return published && published > updated ? published : updated;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [programs, projects, posts, stories, vacancies, pageKeys] = await Promise.all([
    prerenderData('sitemap programmes', () => listProgramSlugs(), []),
    prerenderData('sitemap projects', () => listProjectSlugs(), []),
    prerenderData('sitemap posts', () => listPostSlugs(), []),
    prerenderData('sitemap stories', () => listStorySlugs(), []),
    prerenderData('sitemap vacancies', () => listVacancySlugs(), []),
    prerenderData('sitemap pages', () => listPageKeys(), []),
  ]);

  // Open positions only. A closed vacancy stays reachable for whoever
  // bookmarked it, but a sitemap that keeps advertising it invites Google
  // Jobs to list a job nobody can apply for.
  const today = new Date().toISOString().slice(0, 10);
  const openVacancies = vacancies.filter((vacancy) => vacancy.deadline >= today);

  return [
    ...STATIC_PATHS.flatMap(({ path, changeFrequency, priority }) =>
      entriesFor({ ar: path, en: path }, { changeFrequency, priority }),
    ),

    ...programs.flatMap((row) =>
      entriesFor(recordPaths('/programs', row), {
        lastModified: lastModified(row),
        changeFrequency: 'monthly',
        priority: 0.9,
      }),
    ),

    ...projects.flatMap((row) =>
      entriesFor(recordPaths('/projects', row), {
        lastModified: lastModified(row),
        changeFrequency: 'monthly',
        priority: 0.7,
      }),
    ),

    ...posts.flatMap((row) =>
      entriesFor(recordPaths('/news', row), {
        lastModified: lastModified(row),
        changeFrequency: 'yearly',
        priority: 0.6,
      }),
    ),

    ...stories.flatMap((row) =>
      entriesFor(recordPaths('/impact/stories', row), {
        lastModified: lastModified(row),
        changeFrequency: 'yearly',
        priority: 0.6,
      }),
    ),

    ...openVacancies.flatMap((row) =>
      entriesFor(recordPaths('/careers', row), {
        lastModified: lastModified(row),
        changeFrequency: 'weekly',
        priority: 0.7,
      }),
    ),

    // Legal pages are addressed by key, and the key is the same in both
    // locales. Only the keys the legal route serves are listed; `verify` is
    // a page record too but is rendered at `/verify`, which is static above.
    ...pageKeys
      .filter((row) => ['privacy', 'accessibility', 'terms'].includes(row.key))
      .flatMap((row) =>
        entriesFor(
          row.translationStatus === 'ar_only'
            ? { ar: `/legal/${row.key}` }
            : { ar: `/legal/${row.key}`, en: `/legal/${row.key}` },
          { lastModified: lastModified(row), changeFrequency: 'yearly', priority: 0.3 },
        ),
      ),
  ];
}
