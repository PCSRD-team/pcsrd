import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { organizationName, visibleText } from '@/components/layout/chrome';
import { getOrganization } from '@/db/queries/content';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata } from '@/lib/seo/metadata';
import { ABOUT_PATHS, AboutShell } from '../_components/about-shell';
import { TitledBlockList, VisionMission, VisionMissionEmpty } from '../_components/vision-mission';

export const revalidate = 3600;

/** `/about/vision-mission` — vision, mission, values and principles from `organization_settings`. */

export async function generateMetadata({ params }: PageProps<'/[locale]/about/vision-mission'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [dict, org] = await Promise.all([getDictionary(locale), getOrganization(locale)]);
  return buildMetadata({
    locale,
    path: ABOUT_PATHS['vision-mission'],
    title: dict.aboutPages.visionMissionTitle,
    description: dict.aboutPages.visionMissionLead,
    siteName: organizationName(org),
  });
}

export default async function VisionMissionPage({ params }: PageProps<'/[locale]/about/vision-mission'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, org] = await Promise.all([getDictionary(locale), getOrganization(locale)]);
  const hasStatement = Boolean(visibleText(org?.vision) || visibleText(org?.mission));
  const hasBlocks = (org?.coreValues?.length ?? 0) > 0 || (org?.principles?.length ?? 0) > 0;

  return (
    <AboutShell locale={locale} dict={dict} current="vision-mission">
      {hasStatement ? <VisionMission org={org ?? null} dict={dict} /> : null}
      {!hasStatement && !hasBlocks ? <VisionMissionEmpty dict={dict} /> : null}
      <TitledBlockList
        id="about-values"
        blocks={org?.coreValues}
        locale={locale}
        title={dict.about.values}
        lead={dict.aboutPages.valuesLead}
      />
      <TitledBlockList
        id="about-principles"
        blocks={org?.principles}
        locale={locale}
        title={dict.about.principles}
        lead={dict.aboutPages.principlesLead}
      />
    </AboutShell>
  );
}
