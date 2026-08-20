import type { MetadataRoute } from 'next';
import { listPrograms, listPublications } from '@/db/queries/content';
import { listProjectSlugs } from '@/db/queries/projects';
import { publicEnv } from '@/lib/env.public';
import { LOCALES } from '@/lib/i18n/config';

/**
 * The sitemap.
 *
 * Every entry carries `alternates.languages`, because the two locales are
 * separate URLs for the same content and a crawler that cannot see the pairing
 * treats the English page as thin duplicate content.
 *
 * Only published rows appear — the queries already filter, and RLS refuses the
 * rest to the anonymous identity this build runs as.
 */
export const revalidate = 3600;

const BASE = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');

const STATIC_PATHS = [
  '',
  '/about',
  '/programs',
  '/projects',
  '/impact',
  '/news',
  '/partners',
  '/resources',
  '/careers',
  '/contact',
  '/verify',
  '/get-involved/partner',
  '/get-involved/volunteer',
  '/legal/privacy',
  '/legal/accessibility',
  '/legal/terms',
];

function entry(path: string, lastModified?: Date): MetadataRoute.Sitemap[number] {
  return {
    url: `${BASE}/ar${path}`,
    lastModified,
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((locale) => [locale, `${BASE}/${locale}${path}`]),
      ),
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [programs, projects, publications] = await Promise.all([
    listPrograms('ar'),
    listProjectSlugs(),
    listPublications('ar'),
  ]);

  return [
    ...STATIC_PATHS.map((path) => entry(path)),

    ...programs.map((program) => ({
      url: `${BASE}/ar/programs/${program.slug}`,
      alternates: {
        languages: { ar: `${BASE}/ar/programs/${program.slug}`, en: `${BASE}/en/programs/${program.slug}` },
      },
    })),

    ...projects.map((project) => ({
      url: `${BASE}/ar/projects/${project.slugAr}`,
      lastModified: project.updatedAt,
      alternates: {
        languages: {
          ar: `${BASE}/ar/projects/${project.slugAr}`,
          en: `${BASE}/en/projects/${project.slugEn}`,
        },
      },
    })),

    ...publications.map((publication) => ({
      url: `${BASE}/ar/resources#${publication.slug}`,
    })),
  ];
}
