import Link from 'next/link';
import { Panel } from '@/components/ui/primitives';
import type { ProjectFilters } from '@/db/queries/projects';
import type { Dictionary } from '@/lib/i18n/get-dictionary';
import { type Locale, localePath } from '@/lib/i18n/config';

/**
 * The project facet panel.
 *
 * **A Server Component with a plain `<form method="get">`.** Rule 7 says every
 * form works without JavaScript, and a filter panel is the one people reach for
 * a client component to build. It does not need one: the form submits to the
 * same URL as a GET, the server reads `searchParams`, and the result is a
 * shareable, bookmarkable, back-button-correct URL — which a client-side filter
 * has to reimplement badly.
 *
 * Counts come from `getProjectFacets`, one aggregate query rather than one per
 * option.
 */

type Facets = {
  byProgram: { key: string; count: number }[];
  byGovernorate: { key: string; count: number }[];
  byTheme: { key: string; count: number }[];
  byYear: { key: number; count: number }[];
};

function CheckboxFacet({
  name,
  legend,
  options,
  selected,
  labelFor,
}: {
  name: string;
  legend: string;
  options: { key: string | number; count: number }[];
  selected: string[];
  labelFor: (key: string) => string;
}) {
  if (options.length === 0) return null;

  return (
    <fieldset className="border-bs border-hairline pbs-5">
      <legend className="eyebrow">{legend}</legend>
      <ul className="mbs-3 space-y-2">
        {options.map((option) => {
          const value = String(option.key);
          return (
            <li key={value}>
              <label className="flex items-center gap-3 text-small text-ink">
                <input
                  type="checkbox"
                  name={name}
                  value={value}
                  defaultChecked={selected.includes(value)}
                  className="size-4 accent-navy-700"
                />
                <span className="flex-1">{labelFor(value)}</span>
                <span className="font-mono text-caption text-mono-muted">{option.count}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

export function ProjectFilterPanel({
  locale,
  dict,
  facets,
  filters,
  total,
}: {
  locale: Locale;
  dict: Dictionary;
  facets: Facets;
  filters: ProjectFilters;
  total: number;
}) {
  // Labels come from the dictionary — rule 5. A facet value the dictionary
  // does not know falls back to its raw key, which is visibly wrong rather
  // than invisibly blank.
  const label = (group: keyof Dictionary['enums']) => (key: string) =>
    (dict.enums[group] as Record<string, string>)[key] ?? key;

  return (
    <Panel as="aside" className="p-6" tone="paper">
      <form method="get" aria-label={dict.a11y.filterPanel}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-h3 font-semibold text-ink">{dict.projects.filters}</h2>
          <span className="font-mono text-caption text-mono-muted">
            {total} {dict.projects.results}
          </span>
        </div>

        <div className="mbs-5 space-y-5">
          <CheckboxFacet
            name="program"
            legend={dict.projects.program}
            options={facets.byProgram}
            selected={filters.program ? [filters.program] : []}
            labelFor={label('program')}
          />
          <CheckboxFacet
            name="gov"
            legend={dict.projects.governorate}
            options={facets.byGovernorate}
            selected={filters.governorates ?? []}
            labelFor={label('governorate')}
          />
          <CheckboxFacet
            name="theme"
            legend={dict.projects.theme}
            options={facets.byTheme}
            selected={filters.themes ?? []}
            labelFor={label('theme')}
          />
          <CheckboxFacet
            name="year"
            legend={dict.projects.year}
            options={facets.byYear}
            selected={filters.year ? [String(filters.year)] : []}
            labelFor={(key) => key}
          />
        </div>

        <div className="mbs-6 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            className="bg-navy-700 px-5 py-2 text-small font-medium text-paper hover:bg-navy-900"
          >
            {dict.projects.filters}
          </button>
          {/* A link, not a reset button: it clears the URL too, so the back
              button and a shared link behave the same way. */}
          <Link href={localePath(locale, '/projects')} className="text-small">
            {dict.projects.clearFilters}
          </Link>
        </div>
      </form>
    </Panel>
  );
}
