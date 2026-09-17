import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { organizationName } from '@/components/layout/chrome';
import { getOrganization, listMetrics, listPublications } from '@/db/queries/content';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata } from '@/lib/seo/metadata';
import { ABOUT_PATHS, AboutShell } from '../_components/about-shell';
import { StrategicObjectives, StrategyDocuments, StrategyEmpty, StrategyTargets, resolveLines } from '../_components/strategy';

export const revalidate = 3600;

/**
 * `/about/strategy` — strategic objectives (`organization_settings`), target
 * metrics (`impact_metrics` with `status = 'target'`) and the plan documents
 * (`publications` of type `strategy`).
 */

export async function generateMetadata({ params }: PageProps<'/[locale]/about/strategy'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [dict, org] = await Promise.all([getDictionary(locale), getOrganization(locale)]);
  return buildMetadata({
    locale,
    path: ABOUT_PATHS.strategy,
    title: dict.about.strategy,
    description: dict.aboutPages.strategyLead,
    siteName: organizationName(org),
  });
}

export default async function StrategyPage({ params }: PageProps<'/[locale]/about/strategy'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, org, targets, publications] = await Promise.all([
    getDictionary(locale),
    getOrganization(locale),
    listMetrics(locale, { status: 'target' }),
    listPublications(locale),
  ]);

  const objectives = resolveLines(org?.strategicObjectives, locale);
  const documents = publications.filter((publication) => publication.type === 'strategy');
  const isEmpty = objectives.length === 0 && targets.length === 0 && documents.length === 0;

  return (
    <AboutShell locale={locale} dict={dict} current="strategy">
      {isEmpty ? <StrategyEmpty dict={dict} /> : null}
      <StrategicObjectives lines={org?.strategicObjectives} locale={locale} dict={dict} />
      <StrategyTargets metrics={targets} locale={locale} dict={dict} />
      <StrategyDocuments publications={documents} locale={locale} dict={dict} />
    </AboutShell>
  );
}
