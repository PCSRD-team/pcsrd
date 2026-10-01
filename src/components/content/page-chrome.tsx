import type { ReactNode } from 'react';
import { BreadcrumbJsonLd } from '@/components/seo/json-ld';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { UntranslatedNotice } from '@/components/ui/feedback';
import { Grid, Section, SectionHeading } from '@/components/ui/layout';
import type { Dictionary } from '@/lib/i18n/get-dictionary';
import { DEFAULT_LOCALE, type Locale, localePath, splitLocalePath } from '@/lib/i18n/config';
import { ProjectCard, type ProjectCardRecord } from './cards';

/**
 * Blocks every content route shares.
 *
 * Each of these existed two or three times across the programme, project,
 * post, story and vacancy pages before the kit migration — the same
 * breadcrumb trail, the same untranslated notice, the same "projects in this
 * programme" rail — and each copy had drifted. They live here so the routes
 * compose them and cannot disagree.
 */

export type Crumb = {
  label: string;
  /** Locale-less path (`/projects`); omitted on the current page. */
  path?: string;
};

/**
 * Breadcrumbs with their JSON-LD, from one list. Home is prepended; the last
 * item is the current page and renders as text.
 */
export function ContentBreadcrumbs({
  locale,
  dict,
  trail,
  currentPath,
  className,
}: {
  locale: Locale;
  dict: Dictionary;
  trail: Crumb[];
  /**
   * The current page's canonical path — locale-less (`/news/slug`) or already
   * prefixed (`/ar/news/slug`). Gives the last crumb its URL in the JSON-LD.
   */
  currentPath?: string;
  className?: string;
}) {
  const items = [{ label: dict.nav.home, path: '/' }, ...trail];
  const navItems = items.map((item) => ({
    label: item.label,
    href: item.path ? localePath(locale, item.path) : undefined,
  }));
  // The current page has no `path` (it renders as text), but the structured
  // data must still list it: a BreadcrumbList that stops at the parent tells a
  // search engine the page is not part of its own trail. Only the route knows
  // its canonical URL, so it passes `currentPath`; an item with neither is
  // skipped rather than given a guessed URL.
  const toUrl = (path: string) => (splitLocalePath(path) ? path : localePath(locale, path));
  const lastIndex = items.length - 1;
  const jsonLdItems = items.flatMap((item, index) => {
    const path = item.path ?? (index === lastIndex ? currentPath : undefined);
    return path ? [{ name: item.label, url: toUrl(path) }] : [];
  });

  return (
    <Breadcrumbs
      items={navItems}
      label={dict.a11y.breadcrumb}
      className={className}
      jsonLd={<BreadcrumbJsonLd items={jsonLdItems} />}
    />
  );
}

/**
 * `vacancies.employment_type` holds schema.org vocabulary (`FULL_TIME`), which
 * is right for JSON-LD and wrong on screen. An unknown value falls back to
 * itself rather than to nothing, so a new enum value is visible, not lost.
 */
export function employmentTypeLabel(value: string | null | undefined, dict: Dictionary): string | null {
  if (!value) return null;
  const labels: Record<string, string> = dict.careers.employmentTypes;
  return labels[value] ?? value;
}

/**
 * The untranslated notice, with a link to the Arabic original. Renders
 * nothing when the record has content for this locale, so a route can pass
 * `isTranslated` straight from the query.
 */
export function TranslationNotice({
  locale,
  dict,
  isTranslated,
  arabicPath,
}: {
  locale: Locale;
  dict: Dictionary;
  isTranslated: boolean;
  /** Locale-less path of the Arabic record (`/news/` + `slugAr`). */
  arabicPath: string;
}) {
  if (isTranslated || locale === DEFAULT_LOCALE) return null;
  return (
    <UntranslatedNotice
      title={dict.states.untranslatedTitle}
      body={dict.states.untranslatedBody}
      action={
        <ButtonLink href={localePath(DEFAULT_LOCALE, arabicPath)} tone="marked" size="sm">
          {dict.contentUi.viewArabicOriginal}
        </ButtonLink>
      }
    />
  );
}

/**
 * A rail of project cards under a section heading — "projects in this
 * programme" on a programme page, "related projects" on a project page.
 * Renders nothing for an empty list: the section rule would otherwise open
 * onto nothing.
 */
export function ProjectsRail({
  locale,
  dict,
  projects,
  title,
  id,
  actions,
}: {
  locale: Locale;
  dict: Dictionary;
  projects: ProjectCardRecord[];
  title: string;
  id: string;
  actions?: ReactNode;
}) {
  if (projects.length === 0) return null;
  return (
    <Section labelledBy={id}>
      <SectionHeading id={id} title={title} actions={actions} />
      <Grid as="ul" cols={3}>
        {projects.map((project) => (
          <li key={project.id} className="flex">
            <ProjectCard project={project} locale={locale} dict={dict} />
          </li>
        ))}
      </Grid>
    </Section>
  );
}
