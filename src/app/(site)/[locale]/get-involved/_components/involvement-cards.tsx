import Link from 'next/link';
import { Card, CardBody, CardFooter } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Grid } from '@/components/ui/layout';
import { type Locale, localePath } from '@/lib/i18n/config';
import type { Dictionary } from '@/lib/i18n/get-dictionary';

/**
 * The three doors — partner, volunteer, support — as a row of records with a
 * 2px accent rule each (design: the "get-involved trio"). Shared by the
 * `/get-involved` index and the home page.
 */
export function involvementRoutes(locale: Locale, dict: Dictionary) {
  return [
    {
      key: 'partner',
      title: dict.getInvolved.partnerTitle,
      lead: dict.getInvolved.partnerLead,
      href: localePath(locale, '/get-involved/partner'),
      accent: 'var(--color-prog-protection)',
    },
    {
      key: 'volunteer',
      title: dict.getInvolved.volunteerTitle,
      lead: dict.getInvolved.volunteerLead,
      href: localePath(locale, '/get-involved/volunteer'),
      accent: 'var(--color-prog-recovery)',
    },
    {
      key: 'support',
      title: dict.getInvolved.supportTitle,
      lead: dict.getInvolved.supportLead,
      href: localePath(locale, '/get-involved/support'),
      accent: 'var(--color-prog-response)',
    },
  ] as const;
}

export function InvolvementCards({
  locale,
  dict,
  headingLevel = 2,
}: {
  locale: Locale;
  dict: Dictionary;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <Grid as="ul" cols={3} gap={6}>
      {involvementRoutes(locale, dict).map((route) => (
        <Card as="li" key={route.key} accent={route.accent} interactive>
          <CardBody>
            <Heading className="text-h3 font-semibold text-ink">
              <Link href={route.href} className="text-ink no-underline after:absolute after:inset-0 hover:text-gold-700">
                {route.title}
              </Link>
            </Heading>
            <p className="mbs-3 text-small text-ink-70">{route.lead}</p>
          </CardBody>
          <CardFooter>
            <span className="inline-flex items-center gap-2 text-small font-medium text-navy-700">
              {dict.getInvolved.learnMore}
              <Icon name="arrow" size={16} />
            </span>
          </CardFooter>
        </Card>
      ))}
    </Grid>
  );
}
