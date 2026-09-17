import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { organizationName } from '@/components/layout/chrome';
import { getOrganization, listPeople } from '@/db/queries/content';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata } from '@/lib/seo/metadata';
import { ABOUT_PATHS, AboutShell } from '../_components/about-shell';
import { GovernanceGroups } from '../_components/governance';

export const revalidate = 3600;

/**
 * `/about/governance` — board, executive management and staff. `listPeople`
 * returns only `is_public` rows (DNH-5): a person absent from this page is
 * absent by their own decision, and the page says so.
 */

export async function generateMetadata({ params }: PageProps<'/[locale]/about/governance'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [dict, org] = await Promise.all([getDictionary(locale), getOrganization(locale)]);
  return buildMetadata({
    locale,
    path: ABOUT_PATHS.governance,
    title: dict.about.governance,
    description: dict.aboutPages.governanceLead,
    siteName: organizationName(org),
  });
}

export default async function GovernancePage({ params }: PageProps<'/[locale]/about/governance'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, people] = await Promise.all([getDictionary(locale), listPeople(locale)]);

  return (
    <AboutShell locale={locale} dict={dict} current="governance">
      <GovernanceGroups people={people} dict={dict} />
    </AboutShell>
  );
}
