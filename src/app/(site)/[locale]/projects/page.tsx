import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { paginationRange } from '@/lib/utils';
import { ProjectCard } from '@/components/content/cards';
import { ProjectFilterPanel } from '@/components/content/project-filters';
import { SectionHeading } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { governorate, programKey, projectStatus, themeTag } from '@/db/schema/enums';
import type { Governorate, ProjectStatus, ThemeTag } from '@/db/schema/enums';
import { getProjectFacets, listProjects, type ProjectFilters } from '@/db/queries/projects';
import { isLocale, localePath } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/projects'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    title: dict.projects.title,
    description: dict.projects.lead,
    alternates: {
      canonical: `/${locale}/projects`,
      languages: { ar: '/ar/projects', en: '/en/projects' },
    },
  };
}

/** Query strings are user input. Anything not a known enum member is dropped. */
function readFilters(searchParams: Record<string, string | string[] | undefined>): ProjectFilters {
  const many = (value: string | string[] | undefined): string[] =>
    value === undefined ? [] : Array.isArray(value) ? value : [value];

  const keep = <T extends string>(values: string[], allowed: readonly T[]): T[] =>
    values.filter((v): v is T => (allowed as readonly string[]).includes(v));

  const [program] = keep(many(searchParams.program), programKey.enumValues);
  const [state] = keep(many(searchParams.state), projectStatus.enumValues);
  const year = Number(many(searchParams.year)[0]);
  const page = Number(searchParams.page);

  return {
    program,
    state: state as ProjectStatus | undefined,
    governorates: keep(many(searchParams.gov), governorate.enumValues) as Governorate[],
    themes: keep(many(searchParams.theme), themeTag.enumValues) as ThemeTag[],
    year: Number.isInteger(year) && year > 1990 && year < 2100 ? year : undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Rebuilds the query string for a page link, preserving every active facet. */
function pageHref(
  locale: 'ar' | 'en',
  filters: ProjectFilters,
  page: number,
): string {
  const query = new URLSearchParams();
  if (filters.program) query.set('program', filters.program);
  if (filters.state) query.set('state', filters.state);
  for (const g of filters.governorates ?? []) query.append('gov', g);
  for (const t of filters.themes ?? []) query.append('theme', t);
  if (filters.year) query.set('year', String(filters.year));
  if (page > 1) query.set('page', String(page));
  const qs = query.toString();
  return localePath(locale, `/projects${qs ? `?${qs}` : ''}`);
}

export default async function ProjectsPage({
  params,
  searchParams,
}: PageProps<'/[locale]/projects'>) {
  const [{ locale }, rawSearch] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const filters = readFilters(rawSearch);

  const [dict, result, facets] = await Promise.all([
    getDictionary(locale),
    listProjects(locale, filters),
    getProjectFacets(),
  ]);

  const hasFilters = Boolean(
    filters.program ||
      filters.state ||
      filters.year ||
      filters.governorates?.length ||
      filters.themes?.length,
  );

  return (
    <div className="container-content section-gap">
      <SectionHeading as="h1" title={dict.projects.title} lead={dict.projects.lead} />

      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        <ProjectFilterPanel
          locale={locale}
          dict={dict}
          facets={facets}
          filters={filters}
          total={result.total}
        />

        <div>
          {result.items.length === 0 ? (
            <EmptyState
              title={dict.states.emptyTitle}
              // An empty filtered list and an empty database are different
              // problems, and telling them apart is the difference between
              // "loosen your filters" and "there is nothing here yet".
              body={hasFilters ? dict.states.emptyFiltered : dict.states.emptyBody}
            />
          ) : (
            <>
              <ul className="grid gap-6 sm:grid-cols-2">
                {result.items.map((project) => (
                  <li key={project.id}>
                    <ProjectCard project={project} locale={locale} dict={dict} />
                  </li>
                ))}
              </ul>

              {result.totalPages > 1 ? (
                <nav aria-label={dict.a11y.pagination} className="mbs-10">
                  <ul className="flex flex-wrap items-center gap-2">
                    {paginationRange(result.page, result.totalPages).map((token, index) =>
                      token === 'gap' ? (
                        <li
                          key={`gap-${index}`}
                          aria-hidden="true"
                          className="px-2 py-1 font-mono text-caption text-mono-muted"
                        >
                          …
                        </li>
                      ) : (
                        <li key={token}>
                          <Link
                            href={pageHref(locale, filters, token)}
                            aria-current={token === result.page ? 'page' : undefined}
                            aria-label={
                              token === result.page
                                ? `${dict.a11y.currentPage} ${token}`
                                : `${dict.common.page} ${token}`
                            }
                            className={
                              token === result.page
                                ? 'rule-edge border-ink bg-ink px-3 py-1 font-mono text-caption text-paper no-underline'
                                : 'rule-edge px-3 py-1 font-mono text-caption text-ink no-underline hover:bg-paper-alt'
                            }
                          >
                            {token}
                          </Link>
                        </li>
                      ),
                    )}
                  </ul>
                </nav>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
