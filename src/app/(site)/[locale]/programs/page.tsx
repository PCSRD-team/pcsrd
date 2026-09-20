import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContentBreadcrumbs } from '@/components/content/page-chrome';
import { mediaImage } from '@/components/content/media';
import { getSiteName } from '@/components/content/site';
import { CollectionPageJsonLd } from '@/components/seo/json-ld';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Container, PageHeader } from '@/components/ui/layout';
import { RuledList } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Figure } from '@/components/ui/figure';
import { Eyebrow, Heading } from '@/components/ui/typography';
import { listPrograms } from '@/db/queries/content';
import { isLocale, localePath } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<'/[locale]/programs'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [dict, siteName] = await Promise.all([getDictionary(locale), getSiteName(locale)]);
  return buildMetadata({
    locale,
    path: '/programs',
    title: dict.programs.title,
    description: dict.programs.lead,
    siteName,
  });
}

/**
 * The programme index: one full-width ruled row per programme — code, title,
 * tagline, audience, the eligibility link — with the image on the inline-end
 * side. Three programmes are the organisation's whole identity, so each gets
 * a row rather than a card in a grid.
 */
export default async function ProgramsPage({ params }: PageProps<'/[locale]/programs'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, programs] = await Promise.all([getDictionary(locale), listPrograms(locale)]);
  const targetGroupLabel = (key: string) =>
    (dict.enums.targetGroup as Record<string, string>)[key] ?? key;

  return (
    <Container className="section-gap">
      <CollectionPageJsonLd
        name={dict.programs.title}
        description={dict.programs.lead}
        url={localePath(locale, '/programs')}
        locale={locale}
        items={programs.map((program) => ({
          name: program.title,
          url: localePath(locale, `/programs/${program.slug}`),
        }))}
      />

      <PageHeader
        title={dict.programs.title}
        lede={dict.programs.lead}
        breadcrumbs={<ContentBreadcrumbs locale={locale} dict={dict} trail={[{ label: dict.programs.title }]} />}
      />

      {programs.length === 0 ? (
        <EmptyState title={dict.states.emptyTitle} body={dict.states.emptyBody} bounded />
      ) : (
        <RuledList as="ol" bounded>
          {programs.map((program, index) => {
            const href = localePath(locale, `/programs/${program.slug}`);
            const code = String(index + 1).padStart(2, '0');
            return (
              <li
                key={program.id}
                className="grid gap-6 border-be border-rule py-8 md:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,26rem)] md:gap-8"
                style={{ '--accent': `var(${program.accentToken})` } as CSSProperties}
              >
                <Eyebrow as="div" className="md:pbs-1">
                  <span className="mbe-2 block h-0.5 w-8 bg-[var(--accent)]" aria-hidden="true" />
                  <bdi dir="ltr">{code}</bdi>
                </Eyebrow>
                <article className="min-w-0">
                  <Heading level={2} size="h2">
                    <Link href={href} className="text-ink no-underline hover:text-gold-700">
                      {program.title}
                    </Link>
                  </Heading>
                  {program.tagline ? (
                    <p className="measure mbs-3 text-body text-ink-70">{program.tagline}</p>
                  ) : null}
                  {program.targetGroups.length > 0 ? (
                    <ul className="mbs-4 flex flex-wrap gap-2" aria-label={dict.programs.targetGroups}>
                      {program.targetGroups.map((group) => (
                        <li key={group}>
                          <Badge tone="neutral" uppercase={false}>
                            {targetGroupLabel(group)}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mbs-5">
                    <ButtonLink href={href} tone="marked" size="sm">
                      {dict.programs.eligibility}
                    </ButtonLink>
                  </div>
                </article>
                <Figure
                  image={mediaImage(program.heroPath, program.heroBlur)}
                  alt={program.heroAlt ?? ''}
                  decorative={!program.heroAlt}
                  // 26rem is the column's *cap*; between 768px and the 1180px
                  // content width it is narrower than that, so the hint has to
                  // fall back to a viewport fraction rather than the cap.
                  sizes="(min-width: 1180px) 416px, (min-width: 768px) 40vw, 100vw"
                  fallbackLabel={dict.contentUi.noImage}
                  // The first row's image is the LCP element here; the rest are
                  // below the fold and must not compete with it.
                  preload={index === 0}
                />
              </li>
            );
          })}
        </RuledList>
      )}
    </Container>
  );
}
