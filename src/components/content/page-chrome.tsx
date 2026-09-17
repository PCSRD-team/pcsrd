import type { ReactNode } from 'react';
import { BreadcrumbJsonLd } from '@/components/seo/json-ld';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { UntranslatedNotice } from '@/components/ui/feedback';
import { Grid, Section, SectionHeading } from '@/components/ui/layout';
import type { Dictionary } from '@/lib/i18n/get-dictionary';
import { DEFAULT_LOCALE, type Locale, localePath } from '@/lib/i18n/config';
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
  className,
}: {
  locale: Locale;
  dict: Dictionary;
  trail: Crumb[];
  className?: string;
}) {
  const items = [{ label: dict.nav.home, path: '/' }, ...trail];
  const navItems = items.map((item) => ({
    label: item.label,
    href: item.path ? localePath(locale, item.path) : undefined,
  }));
  // The current page has no `path`; the schema still wants a URL for it, and
  // the page's own canonical is the right one — but only the route knows it.
  // Items without a path are therefore listed by name alone, which the
  // BreadcrumbList spec allows for the final element.
  const jsonLdItems = items
    .filter((item): item is Required<Crumb> => Boolean(item.path))
    .map((item) => ({ name: item.label, url: localePath(locale, item.path) }));

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
