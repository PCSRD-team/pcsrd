import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { organizationName, visibleText } from '@/components/layout/chrome';
import { Badge } from '@/components/ui/badge';
import { Bidi, DateText } from '@/components/ui/bidi';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardFooter, CardMedia, Panel, RuledList, RuledListItem } from '@/components/ui/card';
import { DefinitionList } from '@/components/ui/definition-list';
import { Figure, LogoTile } from '@/components/ui/figure';
import { Icon } from '@/components/ui/icon';
import { Container, Grid, Rule, Section, SectionHeading } from '@/components/ui/layout';
import { Stat, StatGroup } from '@/components/ui/stat';
import { Eyebrow, Heading, Lede } from '@/components/ui/typography';
import { getOrganization, listMetrics, listPartners, listPosts, listPrograms, listStories } from '@/db/queries/content';
import { getProjectFacets, listFeaturedProjects } from '@/db/queries/projects';
import { publicEnv } from '@/lib/env.public';
import { formatDate, formatNumber, formatPeriod, storageUrl } from '@/lib/format';
import { isLocale, localePath, type Locale } from '@/lib/i18n/config';
import { getDictionary, type Dictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata } from '@/lib/seo/metadata';
import { StrategicObjectives } from './about/_components/strategy';
import { InvolvementCards } from './get-involved/_components/involvement-cards';

export const revalidate = 3600;

/**
 * Home — the eleven sections of `04-DESIGN-SYSTEM §3.3`, in render order,
 * closed by the verify block the design uses as the final call to action.
 *
 * Every figure on this page is a published record: an impact metric renders
 * only with its period and verification status (`Stat` refuses otherwise),
 * and the credibility strip counts published rows rather than stating claims.
 * Nothing is typed in; a section with no published content is not rendered.
 */

type Org = NonNullable<Awaited<ReturnType<typeof getOrganization>>>;

function mediaSrc(path: string) {
  return storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, 'media', path);
}

/** A section's header row: eyebrow + title on the start side, the "all …" link on the end side. */
function HomeSectionHeading({
  id,
  index,
  title,
  lead,
  href,
  linkLabel,
}: {
  id: string;
  index: number;
  title: string;
  lead?: string | null;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <SectionHeading
      id={id}
      eyebrow={String(index).padStart(2, '0')}
      title={title}
      lead={lead}
      actions={
        href && linkLabel ? (
          <ButtonLink href={href} tone="marked" size="sm" pendingMark>
            {linkLabel}
          </ButtonLink>
        ) : null
      }
    />
  );
}

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const org = await getOrganization(locale);
  const siteName = organizationName(org);
  return buildMetadata({
    locale,
    path: '/',
    title: siteName,
    description: org?.shortDescription ?? org?.mission,
    siteName,
  });
}

// ── 1. Hero ──────────────────────────────────────────────────────────────

function Hero({ locale, dict, org }: { locale: Locale; dict: Dictionary; org: Org | null }) {
  const name = organizationName(org);
  const statement = visibleText(org?.mission) ?? visibleText(org?.shortDescription);
  const foundedYear = org?.foundedYear && org.foundedYear > 1900 ? String(org.foundedYear) : null;
  const licenseNumber = visibleText(org?.licenseNumber);

  return (
    <Section as="section" bounded={false} labelledBy="home-hero" className="bg-paper">
      <Container className="grid items-center gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
        <div>
          <Eyebrow as="p" className="mbe-3">
            {dict.home.heroEyebrow}
            {foundedYear ? (
              <>
                {' · '}
                {dict.about.foundedYear} <Bidi>{foundedYear}</Bidi>
              </>
            ) : null}
            {licenseNumber ? (
              <>
                {' · '}
                {dict.about.licenseNumber} <Bidi>{licenseNumber}</Bidi>
              </>
            ) : null}
          </Eyebrow>
          <h1 id="home-hero" className="text-h1 font-semibold text-ink text-balance md:text-display-ar">
            {name}
          </h1>
          <Rule weight="mark" as="span" className="mbs-4" />
          {statement ? <Lede className="mbs-5">{statement}</Lede> : null}

          <div className="mbs-8">
            <DefinitionList
              layout="grid"
              className="border-bs border-rule pbs-4 sm:grid-cols-[max-content_1fr_max-content_1fr]"
              items={[
                { term: dict.about.foundedYear, value: foundedYear ? <Bidi>{foundedYear}</Bidi> : null },
                { term: dict.about.licenseNumber, value: licenseNumber ? <Bidi>{licenseNumber}</Bidi> : null },
                { term: dict.about.licenseAuthority, value: visibleText(org?.licenseAuthority) },
                { term: dict.about.legalForm, value: visibleText(org?.legalForm) },
              ]}
            />
          </div>

          <div className="mbs-8 flex flex-wrap items-center gap-4">
            <ButtonLink href={localePath(locale, '/get-involved/partner')} tone="primary" size="lg" pendingMark>
              {dict.nav.partner}
            </ButtonLink>
            <ButtonLink href={localePath(locale, '/verify')} tone="marked" pendingMark>
              {dict.nav.verify}
            </ButtonLink>
          </div>
        </div>

        {/* Decorative: the text carries the meaning and renders before the image. */}
        <Figure
          image={{ src: '/hero-bg.webp', width: 1672, height: 941 }}
          alt=""
          decorative
          ratio="wide"
          preload
          sizes="(min-width: 1180px) 540px, (min-width: 1024px) 46vw, 100vw"
          className="rule-edge"
        />
      </Container>
    </Section>
  );
}

// ── 2. Credibility strip ─────────────────────────────────────────────────

function CredibilityStrip({
  locale,
  dict,
  org,
  governorates,
  partners,
  memberships,
}: {
  locale: Locale;
  dict: Dictionary;
  org: Org | null;
  governorates: number;
  partners: number;
  memberships: number;
}) {
  const years =
    org?.foundedYear && org.foundedYear > 1900 ? new Date().getUTCFullYear() - org.foundedYear : 0;
  const cells = [
    { key: 'years', value: years, label: dict.homePage.yearsActive },
    { key: 'governorates', value: governorates, label: dict.homePage.governoratesCount },
    { key: 'partners', value: partners, label: dict.homePage.partnersCount },
    { key: 'memberships', value: memberships, label: dict.homePage.membershipsCount },
  ].filter((cell) => cell.value > 0);
  if (cells.length === 0) return null;

  return (
    <Section as="section" tone="alt" spacing="tight" bounded={false} labelledBy="home-credibility">
      <h2 id="home-credibility" className="sr-only">
        {dict.homePage.identityTitle}
      </h2>
      <Container>
        <ul className="grid divide-y divide-rule border-y border-rule sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          {cells.map((cell) => (
            <li key={cell.key} className="px-5 py-6 sm:border-s sm:border-rule sm:first:border-s-0">
              <p className="font-mono text-h2 font-semibold leading-none text-ink tabular-nums">
                <Bidi>{formatNumber(cell.value, locale)}</Bidi>
              </p>
              <p className="mbs-2 text-small text-ink-70">{cell.label}</p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

// ── 3. Who we are ────────────────────────────────────────────────────────

function AboutTeaser({ locale, dict, org }: { locale: Locale; dict: Dictionary; org: Org | null }) {
  const description = visibleText(org?.shortDescription) ?? visibleText(org?.vision);
  const hasObjectives = (org?.strategicObjectives?.length ?? 0) > 0;
  if (!description && !hasObjectives) return null;

  return (
    <Section labelledBy="home-about" spacing="default" bounded={false}>
      <Container className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <div>
          <HomeSectionHeading id="home-about" index={1} title={dict.homePage.aboutTitle} />
          {description ? <p className="measure text-body text-ink-70">{description}</p> : null}
          <div className="mbs-6 flex flex-wrap gap-3">
            <ButtonLink href={localePath(locale, '/about')} tone="secondary" pendingMark>
              {dict.homePage.aboutCta}
            </ButtonLink>
            <ButtonLink href={localePath(locale, '/about/governance')} tone="marked" pendingMark>
              {dict.about.governance}
            </ButtonLink>
          </div>
        </div>
        {hasObjectives ? (
          <div>
            <Eyebrow as="p" className="mbe-3">
              {dict.aboutPages.objectivesTitle}
            </Eyebrow>
            <StrategicObjectives lines={org?.strategicObjectives} locale={locale} dict={dict} heading={false} />
          </div>
        ) : null}
      </Container>
    </Section>
  );
}

// ── 4. Programmes ────────────────────────────────────────────────────────

function ProgramsGrid({
  locale,
  dict,
  programs,
}: {
  locale: Locale;
  dict: Dictionary;
  programs: Awaited<ReturnType<typeof listPrograms>>;
}) {
  if (programs.length === 0) return null;

  return (
    <Section tone="alt" labelledBy="home-programs" bounded={false}>
      <Container>
        <HomeSectionHeading
          id="home-programs"
          index={2}
          title={dict.home.programsTitle}
          lead={dict.home.programsLead}
          href={localePath(locale, '/programs')}
          linkLabel={dict.common.viewAll}
        />
        <Grid as="ul" cols={3} gap={6}>
          {programs.map((program, index) => (
            <Card as="li" key={program.id} accent={`var(${program.accentToken})`} interactive>
              <CardBody>
                <p className="font-mono text-eyebrow text-mono-muted">
                  <Bidi>{`P-${String(index + 1).padStart(2, '0')}`}</Bidi>
                  {' · '}
                  {dict.enums.program[program.key]}
                </p>
                <h3 className="mbs-3 text-h3 font-semibold text-ink">
                  <Link
                    href={localePath(locale, `/programs/${program.slug}`)}
                    className="text-ink no-underline after:absolute after:inset-0 hover:text-gold-700"
                  >
                    {program.title}
                  </Link>
                </h3>
                {program.tagline ? <p className="mbs-3 text-small text-ink-70">{program.tagline}</p> : null}
              </CardBody>
              {program.targetGroups.length > 0 ? (
                <CardFooter className="flex-col items-start gap-2">
                  <Eyebrow as="p">{dict.programs.targetGroups}</Eyebrow>
                  <ul className="flex flex-wrap gap-1.5">
                    {program.targetGroups.map((group) => (
                      <li key={group}>
                        <Badge tone="neutral">{dict.enums.targetGroup[group]}</Badge>
                      </li>
                    ))}
                  </ul>
                </CardFooter>
              ) : null}
            </Card>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}

// ── 5. Verified figures ──────────────────────────────────────────────────

function ImpactStrip({
  locale,
  dict,
  metrics,
}: {
  locale: Locale;
  dict: Dictionary;
  metrics: Awaited<ReturnType<typeof listMetrics>>;
}) {
  if (metrics.length === 0) return null;
  const statusLabel = { verified: dict.impact.verified, reported: dict.impact.reported, target: dict.impact.target };

  return (
    <Section labelledBy="home-impact" bounded={false}>
      <Container>
        <HomeSectionHeading
          id="home-impact"
          index={3}
          title={dict.home.impactTitle}
          lead={dict.home.impactLead}
          href={localePath(locale, '/impact')}
          linkLabel={dict.common.viewAll}
        />
        <StatGroup labelledBy="home-impact" className="lg:grid-cols-4">
          {metrics.slice(0, 4).map((metric) => (
            <Stat
              key={metric.id}
              as="li"
              locale={locale}
              value={formatNumber(metric.value, locale)}
              unit={metric.unit}
              label={metric.label ?? ''}
              prefix={metric.displayPrefix === '+' || metric.displayPrefix === '~' ? metric.displayPrefix : null}
              period={{
                start: metric.periodStart,
                end: metric.periodEnd,
                label: formatPeriod(metric.periodStart, metric.periodEnd, locale),
              }}
              verification={{
                status: metric.status,
                label: statusLabel[metric.status],
                source: metric.verificationSource,
              }}
            />
          ))}
        </StatGroup>
        <p className="mbs-6 text-caption text-mono-muted">{dict.homePage.metricsFootnote}</p>
      </Container>
    </Section>
  );
}

// ── 6. Where we work ─────────────────────────────────────────────────────

function WhereWeWork({
  locale,
  dict,
  governorates,
}: {
  locale: Locale;
  dict: Dictionary;
  governorates: { key: string; count: number }[];
}) {
  const rows = governorates.filter((row): row is { key: keyof Dictionary['enums']['governorate']; count: number } =>
    row.key in dict.enums.governorate,
  );
  if (rows.length === 0) return null;

  return (
    <Section tone="alt" labelledBy="home-where" bounded={false}>
      <Container className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div>
          <HomeSectionHeading id="home-where" index={4} title={dict.homePage.whereWeWorkTitle} lead={dict.homePage.whereWeWorkLead} />
          <ButtonLink href={localePath(locale, '/projects')} tone="marked" pendingMark>
            {dict.nav.projects}
          </ButtonLink>
        </div>
        <RuledList as="ol" bounded>
          {rows.map((row, index) => (
            <RuledListItem key={row.key} className="justify-between">
              <span className="flex items-baseline gap-4">
                <Bidi className="font-mono text-eyebrow text-mono-muted">{String(index + 1).padStart(2, '0')}</Bidi>
                <span className="text-body font-medium text-ink">{dict.enums.governorate[row.key]}</span>
              </span>
              <span className="font-mono text-caption text-ink-70 tabular-nums">
                <Bidi>{formatNumber(row.count, locale)}</Bidi> {dict.homePage.projectsUnit}
              </span>
            </RuledListItem>
          ))}
        </RuledList>
      </Container>
    </Section>
  );
}

// ── 7. Selected projects ─────────────────────────────────────────────────

function FeaturedProjects({
  locale,
  dict,
  projects,
}: {
  locale: Locale;
  dict: Dictionary;
  projects: Awaited<ReturnType<typeof listFeaturedProjects>>;
}) {
  if (projects.length === 0) return null;
  const stateLabel = {
    planned: dict.projects.statePlanned,
    active: dict.projects.stateActive,
    completed: dict.projects.stateCompleted,
  } as const;
  const stateTone = { planned: 'planned', active: 'active', completed: 'complete' } as const;

  return (
    <Section labelledBy="home-projects" bounded={false}>
      <Container>
        <HomeSectionHeading
          id="home-projects"
          index={5}
          title={dict.projects.title}
          lead={dict.projects.lead}
          href={localePath(locale, '/projects')}
          linkLabel={dict.common.viewAll}
        />
        <Grid as="ul" cols={2} gap={6}>
          {projects.map((project) => {
            const period = formatPeriod(project.startDate, project.endDate, locale);
            return (
              <Card as="li" key={project.id} interactive>
                {project.heroPath ? (
                  <CardMedia>
                    <Figure
                      image={{ src: mediaSrc(project.heroPath), blurDataURL: project.heroBlur ?? undefined }}
                      alt={project.heroAlt ?? project.title ?? ''}
                      sizes="(min-width: 1180px) 560px, (min-width: 640px) 50vw, 100vw"
                    />
                  </CardMedia>
                ) : null}
                <CardBody>
                  <div className="flex flex-wrap items-center gap-3">
                    {project.programTitle ? <Eyebrow as="p">{project.programTitle}</Eyebrow> : null}
                    <Badge tone={stateTone[project.state]}>{stateLabel[project.state]}</Badge>
                    {period ? (
                      <DateText locale={locale} className="font-mono text-eyebrow text-mono-muted">
                        {period}
                      </DateText>
                    ) : null}
                  </div>
                  <h3 className="mbs-3 text-h3 font-semibold text-ink">
                    <Link
                      href={localePath(locale, `/projects/${project.slug}`)}
                      className="text-ink no-underline after:absolute after:inset-0 hover:text-gold-700"
                    >
                      {project.title}
                    </Link>
                  </h3>
                  {project.summary ? <p className="mbs-3 line-clamp-3 text-small text-ink-70">{project.summary}</p> : null}
                </CardBody>
              </Card>
            );
          })}
        </Grid>
      </Container>
    </Section>
  );
}

// ── 8. From the field ────────────────────────────────────────────────────

function FeaturedStory({
  locale,
  dict,
  story,
}: {
  locale: Locale;
  dict: Dictionary;
  story: Awaited<ReturnType<typeof listStories>>[number] | null;
}) {
  if (!story) return null;
  const href = localePath(locale, `/impact/stories/${story.slug}`);

  return (
    <Section tone="inverse" labelledBy="home-story" bounded={false}>
      <Container className="grid gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:gap-16">
        <div>
          <Eyebrow as="p" className="mbe-3 text-paper/80">
            {String(6).padStart(2, '0')} · {dict.home.storiesTitle}
          </Eyebrow>
          <h2 id="home-story" className="text-h2 font-semibold text-paper">
            {story.title}
          </h2>
          <Rule weight="mark" as="span" className="mbs-4" />
          {story.quote ? (
            <blockquote className="mbs-6 text-lead text-paper">
              <p>{story.quote}</p>
              {story.quoteAttribution ? <footer className="mbs-3 text-small text-paper/80">— {story.quoteAttribution}</footer> : null}
            </blockquote>
          ) : story.summary ? (
            <p className="measure-lead mbs-6 text-lead text-paper">{story.summary}</p>
          ) : null}
          <p className="mbs-8">
            <ButtonLink href={href} tone="secondary" className="border-paper text-paper hover:bg-navy-700 hover:text-paper" pendingMark>
              {dict.homePage.storyCta}
            </ButtonLink>
          </p>
        </div>
        {story.heroPath ? (
          <Figure
            image={{ src: mediaSrc(story.heroPath), blurDataURL: story.heroBlur ?? undefined }}
            alt={story.heroAlt ?? story.title ?? ''}
            ratio="portrait"
            sizes="(min-width: 1180px) 400px, (min-width: 1024px) 35vw, 100vw"
          />
        ) : null}
      </Container>
    </Section>
  );
}

// ── 9. Partners ──────────────────────────────────────────────────────────

function PartnersGrid({
  locale,
  dict,
  partners,
}: {
  locale: Locale;
  dict: Dictionary;
  partners: Awaited<ReturnType<typeof listPartners>>;
}) {
  if (partners.length === 0) return null;
  const featured = partners.filter((partner) => partner.isFeatured);
  const shown = (featured.length > 0 ? featured : partners).slice(0, 8);

  return (
    <Section labelledBy="home-partners" bounded={false}>
      <Container>
        <HomeSectionHeading
          id="home-partners"
          index={7}
          title={dict.home.partnersTitle}
          href={localePath(locale, '/partners')}
          linkLabel={dict.common.viewAll}
        />
        <ul className="grid grid-cols-2 gap-px rule-section bg-rule sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((partner) => (
            <li key={partner.id}>
              <LogoTile
                image={partner.logoPath ? { src: mediaSrc(partner.logoPath) } : null}
                name={partner.name ?? ''}
                href={visibleText(partner.website)}
              />
            </li>
          ))}
        </ul>
        {shown.some((partner) => !partner.logoPath) ? (
          <p className="mbs-4 text-caption text-mono-muted">{dict.partners.logoWithheld}</p>
        ) : null}
      </Container>
    </Section>
  );
}

// ── 10. Get involved ─────────────────────────────────────────────────────

function GetInvolvedPanels({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <Section tone="alt" labelledBy="home-involved" bounded={false}>
      <Container>
        <HomeSectionHeading id="home-involved" index={8} title={dict.homePage.getInvolvedTitle} lead={dict.homePage.getInvolvedLead} />
        <InvolvementCards locale={locale} dict={dict} headingLevel={3} />
      </Container>
    </Section>
  );
}

// ── 11. Latest ───────────────────────────────────────────────────────────

function LatestNews({
  locale,
  dict,
  posts,
}: {
  locale: Locale;
  dict: Dictionary;
  posts: Awaited<ReturnType<typeof listPosts>>['items'];
}) {
  if (posts.length === 0) return null;
  const categoryLabel = {
    news: dict.news.categoryNews,
    statement: dict.news.categoryStatement,
    announcement: dict.news.categoryAnnouncement,
  } as const;
  const categoryTone = { news: 'neutral', statement: 'info', announcement: 'active' } as const;

  return (
    <Section labelledBy="home-news" bounded={false}>
      <Container>
        <HomeSectionHeading
          id="home-news"
          index={9}
          title={dict.home.latestTitle}
          href={localePath(locale, '/news')}
          linkLabel={dict.common.viewAll}
        />
        <RuledList bounded>
          {posts.map((post) => (
            <RuledListItem key={post.id} className="grid gap-x-6 gap-y-1 sm:grid-cols-[140px_120px_minmax(0,1fr)]">
              {post.publishedAt ? (
                <time dateTime={post.publishedAt.toISOString()} className="font-mono text-caption text-mono-muted">
                  <DateText locale={locale}>{formatDate(post.publishedAt, locale)}</DateText>
                </time>
              ) : (
                <span />
              )}
              <span>
                <Badge tone={categoryTone[post.category]}>{categoryLabel[post.category]}</Badge>
              </span>
              <Link href={localePath(locale, `/news/${post.slug}`)} className="text-body font-medium text-ink no-underline hover:text-gold-700">
                {post.title}
              </Link>
            </RuledListItem>
          ))}
        </RuledList>
      </Container>
    </Section>
  );
}

// ── 12. Verify block ─────────────────────────────────────────────────────

function VerifyBlock({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <Section spacing="tight" bounded={false} labelledBy="home-verify">
      <Container>
        <Panel tone="gold" className="flex flex-wrap items-center justify-between gap-6 border-bs-2 border-bs-gold-600">
          <div className="max-w-2xl">
            <Heading level={2} size="h3" id="home-verify">
              {dict.home.verifyTitle}
            </Heading>
            <p className="mbs-2 text-small text-ink-70">{dict.home.verifyLead}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={localePath(locale, '/verify')} tone="primary" pendingMark>
              {dict.channels.barCta}
            </ButtonLink>
            <ButtonLink href={`${localePath(locale, '/verify')}#report`} tone="secondary">
              {dict.verify.reportTitle}
              <Icon name="arrow" size={16} />
            </ButtonLink>
          </div>
        </Panel>
      </Container>
    </Section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, org, programs, metrics, facets, featuredProjects, partners, featuredStories, posts] =
    await Promise.all([
      getDictionary(locale),
      getOrganization(locale),
      listPrograms(locale),
      listMetrics(locale, { status: 'verified', featuredOnly: true }),
      getProjectFacets(),
      listFeaturedProjects(locale, 2),
      listPartners(locale),
      listStories(locale, { limit: 1, featuredOnly: true }),
      listPosts(locale, { limit: 3 }),
    ]);

  const story = featuredStories[0] ?? (await listStories(locale, { limit: 1 }))[0] ?? null;
  const shownMetrics = metrics.length > 0 ? metrics : await listMetrics(locale, { status: 'verified' });
  const memberships = partners.filter((partner) => partner.type === 'network' || partner.type === 'membership');

  return (
    <>
      <Hero locale={locale} dict={dict} org={org ?? null} />
      <CredibilityStrip
        locale={locale}
        dict={dict}
        org={org ?? null}
        governorates={facets.byGovernorate.length}
        partners={partners.length}
        memberships={memberships.length}
      />
      <AboutTeaser locale={locale} dict={dict} org={org ?? null} />
      <ProgramsGrid locale={locale} dict={dict} programs={programs} />
      <ImpactStrip locale={locale} dict={dict} metrics={shownMetrics} />
      <WhereWeWork locale={locale} dict={dict} governorates={facets.byGovernorate} />
      <FeaturedProjects locale={locale} dict={dict} projects={featuredProjects} />
      <FeaturedStory locale={locale} dict={dict} story={story} />
      <PartnersGrid locale={locale} dict={dict} partners={partners} />
      <GetInvolvedPanels locale={locale} dict={dict} />
      <LatestNews locale={locale} dict={dict} posts={posts.items} />
      <VerifyBlock locale={locale} dict={dict} />
    </>
  );
}
