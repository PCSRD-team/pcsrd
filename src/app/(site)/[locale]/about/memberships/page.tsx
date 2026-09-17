import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { organizationName } from '@/components/layout/chrome';
import { ButtonLink } from '@/components/ui/button';
import { getOrganization, listPartners } from '@/db/queries/content';
import { isLocale, localePath } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata } from '@/lib/seo/metadata';
import { ABOUT_PATHS, AboutShell } from '../_components/about-shell';
import { MembershipList, membershipPartners } from '../_components/memberships';

export const revalidate = 3600;

/** `/about/memberships` — partners of type `network` and `membership`. */

export async function generateMetadata({ params }: PageProps<'/[locale]/about/memberships'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [dict, org] = await Promise.all([getDictionary(locale), getOrganization(locale)]);
  return buildMetadata({
    locale,
    path: ABOUT_PATHS.memberships,
    title: dict.about.membership,
    description: dict.aboutPages.membershipsLead,
    siteName: organizationName(org),
  });
}

export default async function MembershipsPage({ params }: PageProps<'/[locale]/about/memberships'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, partners] = await Promise.all([getDictionary(locale), listPartners(locale)]);

  return (
    <AboutShell
      locale={locale}
      dict={dict}
      current="memberships"
      actions={
        <ButtonLink href={localePath(locale, '/partners')} tone="marked" size="sm">
          {dict.aboutPages.allPartners}
        </ButtonLink>
      }
    >
      <MembershipList partners={membershipPartners(partners)} dict={dict} locale={locale} />
    </AboutShell>
  );
}
