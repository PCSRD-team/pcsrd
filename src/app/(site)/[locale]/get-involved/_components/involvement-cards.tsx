import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardBody, CardFooter } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Grid } from "@/components/ui/layout";
import { type Locale, localePath } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

const ACCENT = "var(--color-navy-700)";

function RouteIcon({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="mbe-4 inline-flex size-12 items-center justify-center rounded-full bg-navy-700/5 text-navy-700 transition-colors group-hover:bg-gold-700/10 group-hover:text-gold-700"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </span>
  );
}

const icons = {
  partner: (
    <RouteIcon>
      <circle cx="9" cy="12" r="5" />
      <circle cx="15" cy="12" r="5" />
    </RouteIcon>
  ),
  volunteer: (
    <RouteIcon>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </RouteIcon>
  ),
  support: (
    <RouteIcon>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </RouteIcon>
  ),
} as const;

/**
 * The three doors — partner, volunteer, support. Shared by the
 * `/get-involved` index and the home page.
 */
export function involvementRoutes(locale: Locale, dict: Dictionary) {
  return [
    {
      key: "partner",
      title: dict.getInvolved.partnerTitle,
      lead: dict.getInvolved.partnerLead,
      cta: dict.getInvolved.partnerCta,
      href: localePath(locale, "/get-involved/partner"),
    },
    {
      key: "volunteer",
      title: dict.getInvolved.volunteerTitle,
      lead: dict.getInvolved.volunteerLead,
      cta: dict.getInvolved.volunteerCta,
      href: localePath(locale, "/get-involved/volunteer"),
    },
    {
      key: "support",
      title: dict.getInvolved.supportTitle,
      lead: dict.getInvolved.supportLead,
      cta: dict.getInvolved.supportCta,
      href: localePath(locale, "/get-involved/support"),
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
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <Grid as="ul" cols={3} gap={6}>
      {involvementRoutes(locale, dict).map((route) => (
        <Card
          as="li"
          key={route.key}
          accent={ACCENT}
          interactive
          className="group transition-[box-shadow,background-color,border-color] hover:border-[color-mix(in_srgb,var(--color-gold-600)_45%,var(--color-paper))] hover:bg-gold-050 hover:shadow-lg"
        >
          <CardBody>
            {icons[route.key]}
            <Heading className="text-h3 font-semibold text-ink">
              <Link
                href={route.href}
                className="text-ink no-underline after:absolute after:inset-0 hover:text-gold-700"
              >
                {route.title}
              </Link>
            </Heading>
            <p className="mbs-3 text-small text-ink-70">{route.lead}</p>
          </CardBody>
          <CardFooter>
            <span className="inline-flex items-center gap-2 text-small font-medium text-navy-700 group-hover:text-gold-700">
              {route.cta}
              <span className="transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1">
                <Icon name="arrow" size={16} />
              </span>
            </span>
          </CardFooter>
        </Card>
      ))}
    </Grid>
  );
}
