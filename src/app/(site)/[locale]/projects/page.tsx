import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProjectCard, projectStateLabel } from '@/components/content/cards';
import { ContentBreadcrumbs } from '@/components/content/page-chrome';
import { ProjectFilterPanel } from '@/components/content/project-filters';
import { getSiteName } from '@/components/content/site';
import { CollectionPageJsonLd } from '@/components/seo/json-ld';
import { Badge } from '@/components/ui/badge';
import { Bidi } from '@/components/ui/bidi';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Container, Grid, PageHeader } from '@/components/ui/layout';
import { Pagination } from '@/components/ui/pagination';
import { Meta } from '@/components/ui/typography';
import { governorate, programKey, projectStatus, themeTag } from '@/db/schema/enums';
import type { Governorate, ProjectStatus, ThemeTag } from '@/db/schema/enums';
import { getProjectFacets, listProjects, type ProjectFilters } from '@/db/queries/projects';
import { formatNumber } from '@/lib/format';
import { isLocale, localePath, type Locale } from '@/lib/i18n/config';
import { getDictionary, type Dictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata, withPagination } from '@/lib/seo/metadata';

export const revalidate = 3600;

type SearchParams = Record<string, string | string[] | undefined>;

/** Query strings are user input. Anything not a known enum member is dropped. */
function readFilters(searchParams: SearchParams): ProjectFilters {
  // Repeated keys (`gov=a&gov=b`, what the GET form posts) and comma lists
  // (`gov=a,b`, what the canonical and the pagination links carry) both parse.
  const many = (value: string | string[] | undefined): string[] =>
    (value === undefined ? [] : Array.isArray(value) ? value : [value]).flatMap((v) => v.split(','));

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

/** The active facets as query parameters — for the canonical and the prev/next links. */
function filterParams(filters: ProjectFilters): Record<string, string | undefined> {
  return {
    program: filters.program,
    state: filters.state,
    gov: filters.governorates?.length ? filters.governorates.join(',') : undefined,
    theme: filters.themes?.length ? filters.themes.join(',') : undefined,
    year: filters.year ? String(filters.year) : undefined,
  };
}

/** Rebuilds the query string for a page link, preserving every active facet. */
function pageHref(locale: Locale, filters: ProjectFilters, page: number): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filterParams(filters))) {
    if (value) query.set(key, value);
  }
  if (page > 1) query.set('page', String(page));
  const qs = query.toString();
  return localePath(locale, `/projects${qs ? `?${qs}` : ''}`);
}

function hasActiveFilters(filters: ProjectFilters): boolean {
  return Boolean(
    filters.program ||
      filters.state ||
      filters.year ||
      filters.governorates?.length ||
      filters.themes?.length,
  );
}

/** The applied facets as chips, so the reader sees what the URL says. */
function activeFilterChips(filters: ProjectFilters, dict: Dictionary): string[] {
  const enumLabel = (group: keyof Dictionary['enums'], key: string) =>
    (dict.enums[group] as Record<string, string>)[key] ?? key;
  return [
    ...(filters.program ? [enumLabel('program', filters.program)] : []),
    ...(filters.state ? [projectStateLabel(filters.state, dict)] : []),
    ...(filters.governorates ?? []).map((g) => enumLabel('governorate', g)),
    ...(filters.themes ?? []).map((t) => enumLabel('theme', t)),
    ...(filters.year ? [String(filters.year)] : []),
  ];
}

export async function generateMetadata({ params, searchParams }: PageProps<'/[locale]/projects'>): Promise<Metadata> {
  const [{ locale }, rawSearch] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) return {};
  const filters = readFilters(rawSearch);
  const [dict, siteName, result] = await Promise.all([
    getDictionary(locale),
    getSiteName(locale),
    listProjects(locale, filters),
  ]);

  // SEO-009: the canonical carries the active filters, and each page
  // canonicalises to itself.
  return withPagination(
    buildMetadata({
      locale,
      path: '/projects',
      title: dict.projects.title,
      description: dict.projects.lead,
      siteName,
    }),
    {
      page: result.page,
      hasNext: result.page < result.totalPages,
      hasPrev: result.page > 1,
      params: filterParams(filters),
    },
  );
}

export default async function ProjectsPage({ params, searchParams }: PageProps<'/[locale]/projects'>) {
  const [{ locale }, rawSearch] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const filters = readFilters(rawSearch);

  const [dict, result, facets] = await Promise.all([
    getDictionary(locale),
    listProjects(locale, filters),
    getProjectFacets(),
  ]);

  const filtered = hasActiveFilters(filters);
  const chips = activeFilterChips(filters, dict);

  return (
    <Container className="section-gap">
      <CollectionPageJsonLd
        name={dict.projects.title}
        description={dict.projects.lead}
        url={pageHref(locale, filters, result.page)}
        locale={locale}
        items={result.items.map((project) => ({
          name: project.title,
          url: localePath(locale, `/projects/${project.slug}`),
        }))}
      />

      <PageHeader
        title={dict.projects.title}
        lede={dict.projects.lead}
        breadcrumbs={<ContentBreadcrumbs locale={locale} dict={dict} trail={[{ label: dict.projects.title }]} />}
      />

      {/* The facet column splits off at `lg`, not `md`.
          At `md` the page is 768px wide: 640px of content, 280px of which went
          to the filter panel, leaving a 304px result column that `Grid cols=2`
          then cut into two 124px cards — a hero, an eyebrow, a title, a
          summary and a badge each. `Grid`'s two-up starts at `sm` (640px
          viewport) and has no idea it is inside a narrow column, so the fix is
          to give it the whole width until there is room for both. */}
      <div className="grid gap-10 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-14">
        <ProjectFilterPanel locale={locale} dict={dict} facets={facets} filters={filters} total={result.total} />

        <div className="min-w-0">
          {/* The result count is a live region: after a no-JS GET the page
              reloads anyway, but with client navigation the number changing
              is the only confirmation the filter took. */}
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-be border-rule pbe-4"
            aria-live="polite"
          >
            <Meta as="p">
              <Bidi>{formatNumber(result.total, locale)}</Bidi> {dict.projects.results}
            </Meta>
            {chips.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label={dict.filters.activeFilters}>
                {chips.map((chip) => (
                  <li key={chip}>
                    <Badge tone="info" uppercase={false}>
                      {chip}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {result.items.length === 0 ? (
            <EmptyState
              className="mbs-6"
              title={dict.states.emptyTitle}
              // An empty filtered list and an empty database are different
              // problems, and telling them apart is the difference between
              // "loosen your filters" and "there is nothing here yet".
              body={filtered ? dict.states.emptyFiltered : dict.states.emptyBody}
              action={
                filtered ? (
                  <ButtonLink href={localePath(locale, '/projects')} tone="secondary" size="sm">
                    {dict.projects.clearFilters}
                  </ButtonLink>
                ) : null
              }
            />
          ) : (
            <>
              <Grid as="ul" cols={2} className="mbs-6">
                {result.items.map((project) => (
                  <li key={project.id} className="flex">
                    <ProjectCard project={project} locale={locale} dict={dict} />
                  </li>
                ))}
              </Grid>

              <Pagination
                page={result.page}
                totalPages={result.totalPages}
                hrefFor={(page) => pageHref(locale, filters, page)}
                label={dict.a11y.pagination}
                previousLabel={dict.common.previous}
                nextLabel={dict.common.next}
                pageLabel={(page) => `${dict.common.page} ${page}`}
              />
            </>
          )}
        </div>
      </div>
    </Container>
  );
}
