import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Bidi } from '@/components/ui/bidi';
import { DefinitionList, Panel, Prose, Section, SectionHeading } from '@/components/ui/primitives';
import { getOrganization, listMetrics, listPeople } from '@/db/queries/content';
import type { PersonCategory } from '@/db/schema/enums';
import { publicEnv } from '@/lib/env.public';
import { storageUrl } from '@/lib/format';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<'/[locale]/about'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const [dict, org] = await Promise.all([getDictionary(locale), getOrganization(locale)]);
  return {
    title: dict.about.title,
    description: org?.mission ?? undefined,
    alternates: { canonical: `/${locale}/about`, languages: { ar: '/ar/about', en: '/en/about' } },
  };
}

const CATEGORIES: PersonCategory[] = ['board', 'executive', 'staff'];

export default async function AboutPage({ params }: PageProps<'/[locale]/about'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, org, people, targets] = await Promise.all([
    getDictionary(locale),
    getOrganization(locale),
    listPeople(locale),
    // Targets, not verified figures. On this page the reader is looking at what
    // the organisation intends, and the label on each card says so.
    listMetrics(locale, { status: 'target' }),
  ]);

  return (
    <div className="container-content section-gap">
      <SectionHeading as="h1" title={dict.about.title} />

      {/* The identity record — the single most-reused due-diligence element on
          the site. Every value reads from organization_settings, so it can be
          corrected at launch without a deploy. */}
      <Panel>
        <h2 className="eyebrow mbe-5">{dict.about.identity}</h2>
        <DefinitionList
          items={[
            { term: dict.about.legalName, value: org?.legalName },
            {
              term: dict.about.licenseNumber,
              value: org?.licenseNumber ? <Bidi>{org.licenseNumber}</Bidi> : null,
            },
            { term: dict.about.licenseAuthority, value: org?.licenseAuthority },
            { term: dict.about.legalForm, value: org?.legalForm },
            {
              term: dict.about.foundedYear,
              value: org?.foundedYear ? <Bidi>{String(org.foundedYear)}</Bidi> : null,
            },
          ]}
        />
      </Panel>

      {org?.vision || org?.mission ? (
        <Section labelledBy="about-vision">
          <SectionHeading id="about-vision" title={dict.about.vision} />
          <div className="grid gap-6 md:grid-cols-2">
            {org.vision ? (
              <Panel>
                <h3 className="text-h3 font-semibold">{dict.about.vision}</h3>
                <p className="mbs-4 text-body text-ink-70">{org.vision}</p>
              </Panel>
            ) : null}
            {org.mission ? (
              <Panel>
                <h3 className="text-h3 font-semibold">{dict.about.mission}</h3>
                <p className="mbs-4 text-body text-ink-70">{org.mission}</p>
              </Panel>
            ) : null}
          </div>
        </Section>
      ) : null}

      {org && org.coreValues.length > 0 ? (
        <Section labelledBy="about-values">
          <SectionHeading id="about-values" title={dict.about.values} />
          <ul className="grid gap-6 md:grid-cols-3">
            {org.coreValues.map((value) => (
              <Panel as="li" key={value.title_ar}>
                <h3 className="text-h3 font-semibold">
                  {locale === 'ar' ? value.title_ar : (value.title_en ?? value.title_ar)}
                </h3>
                <p className="mbs-3 text-small text-ink-70">
                  {locale === 'ar' ? value.body_ar : (value.body_en ?? value.body_ar)}
                </p>
              </Panel>
            ))}
          </ul>
        </Section>
      ) : null}

      {org && org.strategicObjectives.length > 0 ? (
        <Section labelledBy="about-strategy">
          <SectionHeading id="about-strategy" title={dict.about.strategy} />
          <Prose>
            <ol className="list-decimal space-y-3 ps-6">
              {org.strategicObjectives.map((objective) => (
                <li key={objective.text_ar}>
                  {locale === 'ar' ? objective.text_ar : (objective.text_en ?? objective.text_ar)}
                </li>
              ))}
            </ol>
          </Prose>

          {targets.length > 0 ? (
            <ul className="mbs-8 grid gap-4 md:grid-cols-3">
              {targets.map((target) => (
                <Panel as="li" key={target.id}>
                  <p className="text-h3 font-semibold text-ink">
                    <Bidi>
                      {target.displayPrefix ?? ''}
                      {target.value}
                    </Bidi>{' '}
                    <span className="text-small font-normal text-ink-70">{target.unit}</span>
                  </p>
                  <p className="mbs-2 text-small text-ink-70">{target.label}</p>
                  <p className="mbs-2 font-mono text-caption text-mono-muted">
                    {dict.impact.target}
                  </p>
                </Panel>
              ))}
            </ul>
          ) : null}
        </Section>
      ) : null}

      {/* DNH-5: the query already filtered to people who opted in, so an empty
          section means nobody consented to being named — not that the
          organisation has no board. */}
      {people.length > 0 ? (
        <Section labelledBy="about-governance">
          <SectionHeading id="about-governance" title={dict.about.governance} />
          {CATEGORIES.map((category) => {
            const group = people.filter((person) => person.category === category);
            if (group.length === 0) return null;

            return (
              <div key={category} className="mbe-10">
                <h3 className="eyebrow mbe-4">{dict.enums.personCategory[category]}</h3>
                <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {group.map((person) => (
                    <Panel as="li" key={person.id} className="flex gap-4">
                      {person.photoPath ? (
                        <div className="relative size-16 shrink-0 overflow-hidden bg-paper-alt">
                          <Image
                            src={storageUrl(
                              publicEnv.NEXT_PUBLIC_SUPABASE_URL,
                              'media',
                              person.photoPath,
                            )}
                            alt={person.photoAlt ?? person.name ?? ''}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        </div>
                      ) : null}
                      <div>
                        <p className="text-small font-medium text-ink">{person.name}</p>
                        <p className="mbs-1 text-caption text-ink-55">{person.role}</p>
                      </div>
                    </Panel>
                  ))}
                </ul>
              </div>
            );
          })}
        </Section>
      ) : null}
    </div>
  );
}
