import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProjectCard } from '@/components/content/cards';
import { organizationName, visibleText } from '@/components/layout/chrome';
import { Badge } from '@/components/ui/badge';
import { Bidi, DateText } from '@/components/ui/bidi';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardFooter, Panel, RuledList, RuledListItem } from '@/components/ui/card';
import { DefinitionList } from '@/components/ui/definition-list';
import { Figure, LogoTile } from '@/components/ui/figure';
import { Icon } from '@/components/ui/icon';
import { Container, Grid, Rule, Section, SectionHeading } from '@/components/ui/layout';
import { Stat, StatGroup } from '@/components/ui/stat';
import { Eyebrow, Heading, Lede } from '@/components/ui/typography';
import { getOrganization, listMetrics, listPartners, listPosts, listPrograms, listStories } from '@/db/queries/content';
import { getProjectFacets, listFeaturedProjects } from '@/db/queries/projects';
import { publicEnv } from '@/lib/env.public';
import { formatDate, formatNumber, formatPeriod, storageUrl, toDateTimeAttr } from '@/lib/format';
import { isLocale, localePath, type Locale } from '@/lib/i18n/config';
import { getDictionary, type Dictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata } from '@/lib/seo/metadata';
import { StrategicObjectives } from './about/_components/strategy';
import { InvolvementCards } from './get-involved/_components/involvement-cards';
import { plural } from '@/lib/i18n/plural';
import styles from './home.module.css';

export const revalidate = 3600;

/**
 * Home — a presentation-only layout with the existing published content,
 * closed by the verify block as the final call to action.
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

/** A section's title and optional link to its full collection. */
function HomeSectionHeading({
  id,
  title,
  lead,
  href,
  linkLabel,
}: {
  id: string;
  title: string;
  lead?: string | null;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <SectionHeading
      id={id}
      className={styles.sectionHeading}
      title={title}
      lead={lead}
      actions={
        href && linkLabel ? (
          <ButtonLink href={href} tone="primary" size="sm" pendingMark>
            {linkLabel}
            <Icon name="arrow" size={16} />
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
    <Section as="section" bounded={false} labelledBy="home-hero" className={styles.hero}>
      <Container className={styles.heroGrid}>
        <div className={styles.heroCopy}>
          {/* The eyebrow used to repeat the founding year and the licence
              number, both of which the identity ledger eight lines below
              states again — with their terms, which the eyebrow could not
              carry. The same two facts twice inside one screenful reads as a
              rendering bug to a due-diligence officer, not as emphasis. The
              ledger is the one that keeps them. */}
          <Eyebrow as="p" className={styles.heroEyebrow}>
            {dict.home.heroEyebrow}
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

        {/* The activity photograph follows the introduction in reading order. */}
        <div className={styles.heroVisual}>
          <svg width="0" height="0" className={styles.heroClipDefinitions} aria-hidden="true" focusable="false">
            <defs>
              <clipPath id="home-hero-photo" clipPathUnits="objectBoundingBox">
                <path d="M0.4,0.025 C0.62,-0.015 0.84,0.085 1,0 L1,0.91 C0.8,0.925 0.68,1.025 0.43,0.975 C0.25,0.94 0.12,0.915 0.06,0.94 C-0.045,0.72 0.015,0.48 0.09,0.29 C0.16,0.11 0.24,0.045 0.4,0.025 Z" />
              </clipPath>
              <clipPath id="home-hero-photo-rtl" clipPathUnits="objectBoundingBox">
                <path transform="translate(1 0) scale(-1 1)" d="M0.4,0.025 C0.62,-0.015 0.84,0.085 1,0 L1,0.91 C0.8,0.925 0.68,1.025 0.43,0.975 C0.25,0.94 0.12,0.915 0.06,0.94 C-0.045,0.72 0.015,0.48 0.09,0.29 C0.16,0.11 0.24,0.045 0.4,0.025 Z" />
              </clipPath>
            </defs>
          </svg>
          <Figure
            image={{ src: '/pcsrd-hero-workshop.png', width: 1536, height: 1024 }}
            alt={locale === 'ar' ? 'مشاركة ترتدي سترة هيئة الهلال الفلسطيني خلال جلسة نقاش جماعية' : 'A participant wearing a PCSRD vest during a group discussion'}
            ratio="wide"
            preload
            sizes="(min-width: 1024px) 55vw, 100vw"
            className={styles.heroImage}
          />
          {foundedYear ? (
            <div className={styles.foundedBadge}>
              <Icon name="calendar" size={24} />
              <strong><Bidi>{foundedYear}</Bidi></strong>
              <span>{dict.about.foundedYear}</span>
            </div>
          ) : null}
        </div>
      </Container>
      <svg className={styles.heroWaves} viewBox="0 0 1440 160" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path fill="var(--color-gold-050)" d="M0 95C240 180 425 5 700 84S1110 155 1440 30V160H0Z" />
        <path fill="var(--color-navy-700)" d="M690 142C960 190 1120 70 1440 0V160H690Z" />
        <path fill="var(--color-gold-600)" d="M970 155C1140 145 1270 63 1440 55V160H970Z" />
        <path fill="var(--color-paper)" d="M0 92C260 175 410 115 640 118S905 202 1150 151S1330 125 1440 116V160H0Z" />
      </svg>
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
    <Section as="section" spacing="tight" bounded={false} labelledBy="home-credibility" className={styles.credibility}>
      <h2 id="home-credibility" className="sr-only">
        {dict.homePage.identityTitle}
      </h2>
      <Container>
        <ul className="grid divide-y divide-rule border-y border-rule sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          {cells.map((cell) => (
            <li key={cell.key} className="px-5 py-6 sm:border-s sm:border-rule sm:first:border-s-0">
              <span className={styles.statIcon}><Icon name={cell.key === 'years' ? 'calendar' : cell.key === 'governorates' ? 'pin' : 'user'} size={24} /></span>
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
    <Section labelledBy="home-about" spacing="default" bounded={false} className={styles.about}>
      <Container>
        <div className={styles.aboutPanel}>
        <div className={styles.aboutCopy}>
          <HomeSectionHeading id="home-about" title={dict.homePage.aboutTitle} />
          {description ? <p className="measure text-body text-ink-70">{description}</p> : null}
          <div className="mbs-6 flex flex-wrap gap-3">
            <ButtonLink href={localePath(locale, '/about')} tone="primary" pendingMark>
              {dict.homePage.aboutCta}
              <Icon name="arrow" size={16} />
            </ButtonLink>
            <ButtonLink href={localePath(locale, '/about/governance')} tone="marked" pendingMark>
              {dict.about.governance}
            </ButtonLink>
          </div>
        </div>
        <div className={styles.aboutVisual}>
          <Figure image={{ src: '/pcsrd-team-meeting.jpg', width: 1080, height: 1080 }} alt={locale === 'ar' ? 'مشاركون في نقاش حول طاولة اجتماع في مقر الهيئة' : 'Participants discussing around a meeting table at PCSRD'} ratio="wide" sizes="(min-width: 1180px) 460px, (min-width: 1024px) 42vw, 100vw" className={styles.aboutImage} />
        </div>
        {hasObjectives ? (
          <div className={styles.objectives}>
            <Eyebrow as="p" className="mbe-3">
              {dict.aboutPages.objectivesTitle}
            </Eyebrow>
            <StrategicObjectives lines={org?.strategicObjectives} locale={locale} dict={dict} heading={false} />
          </div>
        ) : null}
        </div>
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
    <Section labelledBy="home-programs" bounded={false} className={styles.programs}>
      <Container>
        <HomeSectionHeading
          id="home-programs"
          title={dict.home.programsTitle}
          lead={dict.home.programsLead}
        />
        <Grid as="ul" cols={3} gap={6}>
          {programs.map((program, index) => (
            <Card as="li" key={program.id} accent={`var(${program.accentToken})`} interactive className={styles.programCard}>
              <CardBody>
                <span className={styles.programIcon}><Icon name={index === 0 ? 'user' : index === 1 ? 'plus' : 'pin'} size={24} /></span>
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
        <div className={styles.centerAction}>
          <ButtonLink href={localePath(locale, '/programs')} tone="primary" size="sm" pendingMark>
            {dict.common.viewAll}
            <Icon name="arrow" size={16} />
          </ButtonLink>
        </div>
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
    <Section labelledBy="home-impact" bounded={false} className={styles.impact}>
      <Container>
        <HomeSectionHeading
          id="home-impact"
          title={dict.home.impactTitle}
          lead={dict.home.impactLead}
          href={localePath(locale, '/impact')}
          linkLabel={dict.common.viewAll}
        />
        <StatGroup labelledBy="home-impact" className="lg:grid-cols-4">
          {metrics.slice(0, 4).map((metric) => (
            <Stat
              key={metric.id}
              className={styles.metric}
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
    <Section labelledBy="home-where" bounded={false} className={styles.where}>
      <Container className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div>
          <HomeSectionHeading id="home-where" title={dict.homePage.whereWeWorkTitle} lead={dict.homePage.whereWeWorkLead} />
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
                {plural(locale, row.count, dict.programs.projectsCount, formatNumber(row.count, locale))}
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

  return (
    <Section labelledBy="home-projects" bounded={false} className={styles.projects}>
      <Container>
        <HomeSectionHeading
          id="home-projects"
          title={dict.projects.title}
          lead={dict.projects.lead}
          href={localePath(locale, '/projects')}
          linkLabel={dict.common.viewAll}
        />
        {/* `ProjectCard` from the shared kit, not a second drawing of it.
            The local copy rendered the same six things — hero, programme
            eyebrow, state badge, period, title, summary — in a different
            order, with its own state-tone map and its own `sizes`, and had
            already drifted: no `fallbackLabel`, so a project with no hero
            collapsed the image slot here while every other list on the site
            kept the designed no-image frame. */}
        <Grid as="ul" cols={2} gap={6} labelledBy="home-projects">
          {projects.map((project) => (
            <li key={project.id} className="flex">
              <ProjectCard
                project={project}
                locale={locale}
                dict={dict}
                sizes="(min-width: 1180px) 515px, (min-width: 640px) 50vw, 100vw"
              />
            </li>
          ))}
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
    <Section labelledBy="home-story" bounded={false} className={styles.story}>
      <Container className={story.heroPath ? styles.storyCard : styles.storyTextOnly}>
        <div>
          <Eyebrow as="p" className="mbe-3 text-gold-700">
            {dict.home.storiesTitle}
          </Eyebrow>
          <h2 id="home-story" className="text-h2 font-semibold text-ink">
            {story.title}
          </h2>
          <Rule weight="mark" as="span" className="mbs-4" />
          {story.quote ? (
            <blockquote className="mbs-6 text-lead text-ink-70">
              <p>{story.quote}</p>
              {story.quoteAttribution ? <footer className="mbs-3 text-small text-ink-55">— {story.quoteAttribution}</footer> : null}
            </blockquote>
          ) : story.summary ? (
            <p className="measure-lead mbs-6 text-lead text-ink-70">{story.summary}</p>
          ) : null}
          <p className="mbs-8">
            <ButtonLink href={href} tone="primary" pendingMark>
              {dict.homePage.storyCta}
            </ButtonLink>
          </p>
        </div>
        {story.heroPath ? (
          <Figure
            image={{ src: mediaSrc(story.heroPath), blurDataURL: story.heroBlur ?? undefined }}
            alt={story.heroAlt ?? story.title ?? ''}
            ratio="portrait"
            className={styles.storyImage}
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
    <Section labelledBy="home-partners" bounded={false} className={styles.partners}>
      <Container>
        <HomeSectionHeading
          id="home-partners"
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
    <Section labelledBy="home-involved" bounded={false} className={styles.involved}>
      <Container>
        <HomeSectionHeading id="home-involved" title={dict.homePage.getInvolvedTitle} lead={dict.homePage.getInvolvedLead} />
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
    <Section labelledBy="home-news" bounded={false} className={styles.news}>
      <Container>
        <HomeSectionHeading
          id="home-news"
          title={dict.home.latestTitle}
          href={localePath(locale, '/news')}
          linkLabel={dict.common.viewAll}
        />
        <RuledList className={styles.newsGrid}>
          {posts.map((post) => (
            <RuledListItem key={post.id} className={styles.newsCard}>
              {post.publishedAt ? (
                <time dateTime={toDateTimeAttr(post.publishedAt)} className="font-mono text-caption text-mono-muted">
                  <DateText locale={locale}>{formatDate(post.publishedAt, locale)}</DateText>
                </time>
              ) : (
                <span />
              )}
              <span>
                <Badge tone={categoryTone[post.category]}>{categoryLabel[post.category]}</Badge>
              </span>
              <Link href={localePath(locale, `/news/${post.slug}`)} className="text-body font-medium text-ink no-underline hover:text-gold-700">
                <h3 className={styles.newsTitle}>{post.title}</h3>
                <span className={styles.newsReadMore}>
                  {dict.common.readMore}
                  <span className={styles.newsArrow}><Icon name="arrow" size={20} /></span>
                </span>
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
    <Section spacing="tight" bounded={false} labelledBy="home-verify" className={styles.verify}>
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
      listPosts(locale, { limit: 3, featuredOnly: true }),
    ]);

  // Featured first, latest as the fallback, for the story, the metrics and the
  // posts. The `is_featured` checkbox had a writer in the news form and no
  // reader anywhere on the site, so marking a post as featured did nothing.
  // The three fallbacks are independent, so they run together rather than as
  // up to three more round trips in series after the first wave.
  const [fallbackStories, fallbackMetrics, fallbackPosts] = await Promise.all([
    featuredStories.length > 0 ? null : listStories(locale, { limit: 1 }),
    metrics.length > 0 ? null : listMetrics(locale, { status: 'verified' }),
    posts.items.length > 0 ? null : listPosts(locale, { limit: 3 }),
  ]);
  const story = featuredStories[0] ?? fallbackStories?.[0] ?? null;
  const shownMetrics = fallbackMetrics ?? metrics;
  const shownPosts = fallbackPosts ?? posts;
  const memberships = partners.filter((partner) => partner.type === 'network' || partner.type === 'membership');

  return (
    <div className={styles.home}>
      <Hero locale={locale} dict={dict} org={org ?? null} />
      <ProgramsGrid locale={locale} dict={dict} programs={programs} />
      <AboutTeaser locale={locale} dict={dict} org={org ?? null} />
      <CredibilityStrip
        locale={locale}
        dict={dict}
        org={org ?? null}
        governorates={facets.byGovernorate.length}
        partners={partners.length}
        memberships={memberships.length}
      />
      <ImpactStrip locale={locale} dict={dict} metrics={shownMetrics} />
      <FeaturedStory locale={locale} dict={dict} story={story} />
      <LatestNews locale={locale} dict={dict} posts={shownPosts.items} />
      <GetInvolvedPanels locale={locale} dict={dict} />
      <FeaturedProjects locale={locale} dict={dict} projects={featuredProjects} />
      <WhereWeWork locale={locale} dict={dict} governorates={facets.byGovernorate} />
      <PartnersGrid locale={locale} dict={dict} partners={partners} />
      <VerifyBlock locale={locale} dict={dict} />
    </div>
  );
}
