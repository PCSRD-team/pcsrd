import Link from 'next/link';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardFooter, CardMedia } from '@/components/ui/card';
import { Figure } from '@/components/ui/figure';
import { Container, Grid, Rule } from '@/components/ui/layout';
import { Eyebrow, Heading, Lede } from '@/components/ui/typography';
import type { Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

/**
 * The programme hero on the home page.
 *
 * This used to be a Client Component carousel: autoplay, swipe, arrow keys,
 * `rounded-2xl` frames and three flavours of drop shadow. It has been
 * replaced by a static grid, and the export name is kept so the home page's
 * import keeps resolving.
 *
 * Why static: a carousel hides two of the three programmes at any moment,
 * moves without being asked, and needs JavaScript to show the rest — on a
 * site whose readers are on constrained connections and whose three
 * programmes are the organisation's whole identity. Three `Figure` cards in
 * a row show everything, at once, with no script, and obey the design
 * system's radius-0 / no-shadow / three-rule-weights constraints mechanically
 * because they are the kit's own cards.
 *
 * Copy comes from the dictionary (RULE 5); the organisation's name comes
 * from the caller, which read it from `organization_settings` (RULE 6).
 */

export type ProgrammeHeroItem = {
  id: string;
  href: string;
  title: string;
  summary: string | null;
  imageSrc: string | null;
  imageAlt: string | null;
  imageBlur: string | null;
  accentToken: string;
};

export type ProgrammeHeroIdentity = {
  acronym: string | null;
  name: string | null;
  label: string;
};

export async function ProgrammeHeroCarousel({
  locale,
  programmes,
  identity,
}: {
  locale: Locale;
  programmes: ProgrammeHeroItem[];
  identity?: ProgrammeHeroIdentity;
}) {
  if (programmes.length === 0) return null;
  const dict = await getDictionary(locale);
  const headingId = 'programme-hero-heading';

  return (
    <section aria-labelledby={headingId} data-testid="programme-hero" className="bg-paper pbs-10 pbe-12">
      <Container>
        <div className="mbe-8">
          <Eyebrow className="mbe-3">{identity?.label ?? dict.home.programsTitle}</Eyebrow>
          <Heading level={2} size="h1" id={headingId}>
            {identity?.name ?? dict.home.programsTitle}
          </Heading>
          <Rule weight="mark" as="span" className="mbs-4" />
          <Lede className="mbs-5">{dict.home.programsLead}</Lede>
        </div>

        <Grid as="ul" cols={3}>
          {programmes.map((item, index) => (
            <li key={item.id} className="flex">
              <Card as="article" accent={`var(${item.accentToken})`} interactive className="w-full">
                <CardMedia>
                  <Figure
                    image={item.imageSrc ? { src: item.imageSrc, blurDataURL: item.imageBlur ?? undefined } : null}
                    alt={item.imageAlt ?? item.title}
                    sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
                    preload={index === 0}
                    fallbackLabel={dict.contentUi.noImage}
                  />
                </CardMedia>
                <CardBody>
                  <Eyebrow>{dict.home.programsTitle}</Eyebrow>
                  <Heading level={3} size="h3" className="mbs-2">
                    <Link href={item.href} className="text-ink no-underline hover:text-gold-700">
                      {item.title}
                    </Link>
                  </Heading>
                  {item.summary ? <p className="mbs-3 text-small text-ink-70">{item.summary}</p> : null}
                </CardBody>
                <CardFooter>
                  <ButtonLink href={item.href} tone="marked" size="sm">
                    {dict.contentUi.exploreProgram}
                  </ButtonLink>
                </CardFooter>
              </Card>
            </li>
          ))}
        </Grid>
      </Container>
    </section>
  );
}
