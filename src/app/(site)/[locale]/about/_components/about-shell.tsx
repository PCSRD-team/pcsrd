import type { ReactNode } from 'react';
import { SiteBreadcrumbs, type Crumb } from '@/components/layout/site-breadcrumbs';
import { Container, PageHeader } from '@/components/ui/layout';
import { Tabs } from '@/components/ui/tabs';
import { type Locale, localePath } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n/get-dictionary';

/**
 * The `/about` cluster — "the due-diligence cluster" in the design — is five
 * routes sharing one sub-navigation: a tab row directly under the page
 * header, the current tab marked with the 2px ink rule. Tabs are links, so
 * every page is a URL a funder can send to a colleague.
 */

export type AboutSection = 'overview' | 'vision-mission' | 'governance' | 'strategy' | 'memberships';

export const ABOUT_PATHS: Record<AboutSection, string> = {
  overview: '/about',
  'vision-mission': '/about/vision-mission',
  governance: '/about/governance',
  strategy: '/about/strategy',
  memberships: '/about/memberships',
};

export function aboutSectionTitle(dict: Dictionary, section: AboutSection): string {
  switch (section) {
    case 'overview':
      return dict.about.title;
    case 'vision-mission':
      return dict.aboutPages.visionMissionTitle;
    case 'governance':
      return dict.about.governance;
    case 'strategy':
      return dict.about.strategy;
    case 'memberships':
      return dict.about.membership;
  }
}

export function aboutSectionLead(dict: Dictionary, section: AboutSection): string {
  switch (section) {
    case 'overview':
      return dict.aboutPages.overviewLead;
    case 'vision-mission':
      return dict.aboutPages.visionMissionLead;
    case 'governance':
      return dict.aboutPages.governanceLead;
    case 'strategy':
      return dict.aboutPages.strategyLead;
    case 'memberships':
      return dict.aboutPages.membershipsLead;
  }
}

const ORDER: AboutSection[] = ['overview', 'vision-mission', 'governance', 'strategy', 'memberships'];

export function AboutNav({
  locale,
  dict,
  current,
}: {
  locale: Locale;
  dict: Dictionary;
  current: AboutSection;
}) {
  return (
    <Tabs
      label={dict.about.title}
      items={ORDER.map((section) => ({
        label: aboutSectionTitle(dict, section),
        href: localePath(locale, ABOUT_PATHS[section]),
        current: section === current,
      }))}
    />
  );
}

/**
 * Page header + breadcrumbs + sub-navigation for one about page. The overview
 * is a child of home; every other section is a child of the overview.
 */
export function AboutShell({
  locale,
  dict,
  current,
  actions,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  current: AboutSection;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const trail: Crumb[] =
    current === 'overview'
      ? [{ label: dict.about.title, path: ABOUT_PATHS.overview }]
      : [
          { label: dict.about.title, path: ABOUT_PATHS.overview },
          { label: aboutSectionTitle(dict, current), path: ABOUT_PATHS[current] },
        ];

  return (
    <Container className="section-gap">
      <PageHeader
        eyebrow={dict.aboutPages.eyebrow}
        title={aboutSectionTitle(dict, current)}
        lede={aboutSectionLead(dict, current)}
        breadcrumbs={<SiteBreadcrumbs locale={locale} dict={dict} trail={trail} />}
        actions={actions}
        className="mbe-6"
      />
      <AboutNav locale={locale} dict={dict} current={current} />
      <div className="mbs-10 space-y-16">{children}</div>
    </Container>
  );
}
