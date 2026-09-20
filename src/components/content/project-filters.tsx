import { Bidi } from '@/components/ui/bidi';
import { Button, ButtonLink } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { Fieldset, FormActions } from '@/components/ui/field';
import { Checkbox, RadioGroup } from '@/components/ui/inputs';
import { Heading, Meta } from '@/components/ui/typography';
import type { ProjectFilters } from '@/db/queries/projects';
import { formatNumber } from '@/lib/format';
import type { Dictionary } from '@/lib/i18n/get-dictionary';
import { type Locale, localePath } from '@/lib/i18n/config';
import { projectStateLabel } from './cards';

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
 * option. The controls are the kit's: `Fieldset` for the group, `Checkbox`
 * per option (its label carries the count in mono), `RadioGroup` for the
 * single-choice state facet.
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
  locale,
}: {
  name: string;
  legend: string;
  options: { key: string | number; count: number }[];
  selected: string[];
  labelFor: (key: string) => string;
  locale: Locale;
}) {
  if (options.length === 0) return null;

  return (
    <Fieldset name={name} legend={legend} className="border-bs border-hairline pbs-4">
      <ul className="grid gap-0">
        {options.map((option) => {
          const value = String(option.key);
          return (
            <li key={value}>
              <Checkbox
                name={name}
                id={`${name}-${value}`}
                value={value}
                defaultChecked={selected.includes(value)}
                label={
                  <span className="flex items-baseline gap-3">
                    <span className="flex-1">{labelFor(value)}</span>
                    <Meta as="span">
                      <Bidi>{formatNumber(option.count, locale)}</Bidi>
                    </Meta>
                  </span>
                }
              />
            </li>
          );
        })}
      </ul>
    </Fieldset>
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

  const headingId = 'project-filters-heading';

  return (
    // Sticky from `lg`, matching the breakpoint at which `/projects` actually
    // puts the panel in a column beside the results. Below that it is a
    // full-width block above them and must scroll away with the page.
    <Panel as="aside" padding="sm" labelledBy={headingId} className="lg:sticky lg:inset-bs-6 lg:self-start">
      <form method="get" aria-label={dict.a11y.filterPanel}>
        <div className="flex items-baseline justify-between gap-3 pbe-4">
          <Heading level={2} size="h4" id={headingId}>
            {dict.projects.filters}
          </Heading>
          <Meta as="p">
            <Bidi>{formatNumber(total, locale)}</Bidi> {dict.projects.results}
          </Meta>
        </div>

        <div className="space-y-4">
          <CheckboxFacet
            name="program"
            legend={dict.projects.program}
            options={facets.byProgram}
            selected={filters.program ? [filters.program] : []}
            labelFor={label('program')}
            locale={locale}
          />
          <RadioGroup
            name="state"
            legend={dict.projects.state}
            columns={1}
            className="border-bs border-hairline pbs-4"
            defaultValue={filters.state ?? ''}
            options={[
              { value: '', label: dict.filters.all },
              { value: 'active', label: projectStateLabel('active', dict) },
              { value: 'completed', label: projectStateLabel('completed', dict) },
              { value: 'planned', label: projectStateLabel('planned', dict) },
            ]}
          />
          <CheckboxFacet
            name="gov"
            legend={dict.projects.governorate}
            options={facets.byGovernorate}
            selected={filters.governorates ?? []}
            labelFor={label('governorate')}
            locale={locale}
          />
          <CheckboxFacet
            name="theme"
            legend={dict.projects.theme}
            options={facets.byTheme}
            selected={filters.themes ?? []}
            labelFor={label('theme')}
            locale={locale}
          />
          <CheckboxFacet
            name="year"
            legend={dict.projects.year}
            options={facets.byYear}
            selected={filters.year ? [String(filters.year)] : []}
            labelFor={(key) => key}
            locale={locale}
          />
        </div>

        <FormActions>
          <Button type="submit" size="sm">
            {dict.filters.apply}
          </Button>
          {/* A link, not a reset button: it clears the URL too, so the back
              button and a shared link behave the same way. */}
          <ButtonLink href={localePath(locale, '/projects')} tone="quiet" size="sm">
            {dict.projects.clearFilters}
          </ButtonLink>
        </FormActions>
      </form>
    </Panel>
  );
}
