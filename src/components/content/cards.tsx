import Link from 'next/link';
import { Badge, VerificationBadge } from '@/components/ui/badge';
import { Bidi, DateText } from '@/components/ui/bidi';
import { Card, CardBody, CardFooter, CardMedia } from '@/components/ui/card';
import { Figure } from '@/components/ui/figure';
import { Stat } from '@/components/ui/stat';
import { Eyebrow, Heading, Meta } from '@/components/ui/typography';
import { formatDate, formatNumber, formatPeriod } from '@/lib/format';
import type { Dictionary } from '@/lib/i18n/get-dictionary';
import { type Locale, localePath } from '@/lib/i18n/config';
import { mediaImage } from './media';

/**
 * Cards — thin compositions of the kit.
 *
 * Nothing here draws its own rule, ground or radius: the surface is `Card`,
 * the image slot is `CardMedia` + `Figure`, the state chip is `Badge`, the
 * figure is `Stat`. Every one of these renders correctly with **no image** —
 * the organisation does not hold photo consent for most of its work, so an
 * absent hero is the normal case, and the kit's designed no-image frame is
 * what shows.
 *
 * The title is the link, never the whole card: a card that is one big anchor
 * swallows the badge, the period and any text a reader wants to select.
 */

const CARD_SIZES = '(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw';

const titleLink = 'text-ink no-underline hover:text-gold-700';

// ── Project ──────────────────────────────────────────────────────────────

const PROJECT_STATE_TONE = {
  active: 'active',
  completed: 'complete',
  planned: 'planned',
} as const;

export function projectStateLabel(
  state: 'planned' | 'active' | 'completed',
  dict: Dictionary,
): string {
  return {
    planned: dict.projects.statePlanned,
    active: dict.projects.stateActive,
    completed: dict.projects.stateCompleted,
  }[state];
}

export type ProjectCardRecord = {
  id: string;
  slug: string;
  title: string | null;
  summary: string | null;
  state: 'planned' | 'active' | 'completed';
  startDate: string | null;
  endDate: string | null;
  programTitle: string | null;
  heroPath: string | null;
  heroAlt: string | null;
  heroBlur: string | null;
};

export function ProjectCard({
  project,
  locale,
  dict,
}: {
  project: ProjectCardRecord;
  locale: Locale;
  dict: Dictionary;
}) {
  const period = formatPeriod(project.startDate, project.endDate, locale);
  const href = localePath(locale, `/projects/${project.slug}`);

  return (
    <Card as="article" interactive className="w-full">
      <CardMedia>
        <Figure
          image={mediaImage(project.heroPath, project.heroBlur)}
          alt={project.heroAlt ?? ''}
          decorative={!project.heroAlt}
          sizes={CARD_SIZES}
          fallbackLabel={dict.contentUi.noImage}
        />
      </CardMedia>
      <CardBody>
        {project.programTitle ? <Eyebrow>{project.programTitle}</Eyebrow> : null}
        <Heading level={3} size="h3" className="mbs-2">
          <Link href={href} className={titleLink}>
            {project.title}
          </Link>
        </Heading>
        {project.summary ? (
          <p className="mbs-3 line-clamp-3 text-small text-ink-70">{project.summary}</p>
        ) : null}
      </CardBody>
      <CardFooter>
        <Badge tone={PROJECT_STATE_TONE[project.state]} dot>
          {projectStateLabel(project.state, dict)}
        </Badge>
        {period ? (
          <Meta as="span">
            <DateText locale={locale}>{period}</DateText>
          </Meta>
        ) : null}
      </CardFooter>
    </Card>
  );
}

// ── Post ─────────────────────────────────────────────────────────────────

export function postCategoryLabel(
  category: 'news' | 'statement' | 'announcement',
  dict: Dictionary,
): string {
  return {
    news: dict.news.categoryNews,
    statement: dict.news.categoryStatement,
    announcement: dict.news.categoryAnnouncement,
  }[category];
}

export function PostCard({
  post,
  locale,
  dict,
}: {
  post: {
    id: string;
    slug: string;
    category: 'news' | 'statement' | 'announcement';
    title: string | null;
    excerpt: string | null;
    publishedAt: Date | null;
    heroPath: string | null;
    heroAlt: string | null;
    heroBlur: string | null;
  };
  locale: Locale;
  dict: Dictionary;
}) {
  const href = localePath(locale, `/news/${post.slug}`);

  return (
    <Card as="article" interactive className="w-full sm:flex-row sm:items-stretch sm:gap-6">
      {/* A square thumbnail on the inline-start side from `sm`; above the
          text below it. `CardMedia` is for a full-bleed top slot, so the
          figure sits in a sized box of its own here. */}
      <div className="mbe-5 sm:mbe-0 sm:w-40 sm:shrink-0">
        <Figure
          image={mediaImage(post.heroPath, post.heroBlur)}
          alt={post.heroAlt ?? ''}
          decorative={!post.heroAlt}
          ratio="square"
          sizes="(min-width: 640px) 160px, 100vw"
          fallbackLabel={dict.contentUi.noImage}
        />
      </div>
      <CardBody className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Eyebrow as="span">{postCategoryLabel(post.category, dict)}</Eyebrow>
          {post.publishedAt ? (
            <Meta as="span">
              <time dateTime={post.publishedAt.toISOString()}>
                <DateText locale={locale}>{formatDate(post.publishedAt, locale)}</DateText>
              </time>
            </Meta>
          ) : null}
        </div>
        <Heading level={3} size="h3" className="mbs-2">
          <Link href={href} className={titleLink}>
            {post.title}
          </Link>
        </Heading>
        {post.excerpt ? <p className="mbs-3 line-clamp-2 text-small text-ink-70">{post.excerpt}</p> : null}
      </CardBody>
    </Card>
  );
}

// ── Impact metric ────────────────────────────────────────────────────────

export function verificationLabel(status: 'target' | 'reported' | 'verified', dict: Dictionary): string {
  return {
    verified: dict.impact.verified,
    reported: dict.impact.reported,
    target: dict.impact.target,
  }[status];
}

/**
 * A published figure **always** renders with its period and verification
 * status. `Stat` has no prop that turns either off and renders nothing when
 * either is empty — the rule is enforced by the component having no way to
 * express the alternative.
 */
export function MetricCard({
  metric,
  locale,
  dict,
  as = 'li',
}: {
  metric: {
    id: string;
    label: string | null;
    value: string;
    unit: string;
    displayPrefix: string | null;
    periodStart: string;
    periodEnd: string;
    status: 'target' | 'reported' | 'verified';
    verificationSource: string | null;
  };
  locale: Locale;
  dict: Dictionary;
  as?: 'li' | 'div';
}) {
  const prefix = metric.displayPrefix === '+' || metric.displayPrefix === '~' ? metric.displayPrefix : null;
  return (
    <Stat
      as={as}
      locale={locale}
      value={formatNumber(metric.value, locale)}
      prefix={prefix}
      unit={metric.unit}
      label={metric.label ?? ''}
      period={{
        start: metric.periodStart,
        end: metric.periodEnd,
        label: formatPeriod(metric.periodStart, metric.periodEnd, locale),
      }}
      verification={{
        status: metric.status,
        label: verificationLabel(metric.status, dict),
        source: metric.verificationSource,
      }}
    />
  );
}

/** The stamp alone — for a table cell or a heading meta row. */
export function MetricStatus({
  status,
  dict,
}: {
  status: 'target' | 'reported' | 'verified';
  dict: Dictionary;
}) {
  return <VerificationBadge status={status} label={verificationLabel(status, dict)} />;
}

// ── Vacancy ──────────────────────────────────────────────────────────────

export function vacancyTypeLabel(type: 'job' | 'volunteer', dict: Dictionary): string {
  return type === 'job' ? dict.contentUi.vacancyJob : dict.contentUi.vacancyVolunteer;
}

export function VacancyCard({
  vacancy,
  locale,
  dict,
}: {
  vacancy: {
    id: string;
    slug: string;
    type: 'job' | 'volunteer';
    title: string | null;
    location: string | null;
    deadline: string;
  };
  locale: Locale;
  dict: Dictionary;
}) {
  const href = localePath(locale, `/careers/${vacancy.slug}`);

  return (
    <Card as="li" interactive padding="sm" className="w-full sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <CardBody>
        <Eyebrow as="span">{vacancyTypeLabel(vacancy.type, dict)}</Eyebrow>
        <Heading level={3} size="h4" className="mbs-1">
          <Link href={href} className={titleLink}>
            {vacancy.title}
          </Link>
        </Heading>
        {vacancy.location ? <p className="mbs-1 text-small text-ink-55">{vacancy.location}</p> : null}
      </CardBody>
      <Meta as="p" className="shrink-0">
        {dict.careers.deadline}:{' '}
        <time dateTime={vacancy.deadline}>
          <DateText locale={locale}>{formatDate(vacancy.deadline, locale)}</DateText>
        </time>
      </Meta>
    </Card>
  );
}

// ── Programme ────────────────────────────────────────────────────────────

export function ProgramCard({
  program,
  locale,
  dict,
  projectCount,
}: {
  program: {
    id: string;
    key: string;
    slug: string;
    title: string | null;
    tagline: string | null;
    accentToken: string;
    heroPath: string | null;
    heroAlt: string | null;
    heroBlur: string | null;
  };
  locale: Locale;
  dict: Dictionary;
  /** Published projects in the programme, when the caller has the count. */
  projectCount?: number | null;
}) {
  const href = localePath(locale, `/programs/${program.slug}`);

  return (
    // Programme identity is the 2px accent rule in the programme's own
    // colour — the only colour outside ink/gold/paper on the page, and a
    // rule rather than a fill, the same discipline as the gold mark.
    <Card as="article" accent={`var(${program.accentToken})`} interactive className="w-full">
      <CardMedia>
        <Figure
          image={mediaImage(program.heroPath, program.heroBlur)}
          alt={program.heroAlt ?? ''}
          decorative={!program.heroAlt}
          sizes={CARD_SIZES}
          fallbackLabel={dict.contentUi.noImage}
        />
      </CardMedia>
      <CardBody>
        <Eyebrow>{dict.programs.title}</Eyebrow>
        <Heading level={3} size="h3" className="mbs-2">
          <Link href={href} className={titleLink}>
            {program.title}
          </Link>
        </Heading>
        {program.tagline ? <p className="mbs-3 text-small text-ink-70">{program.tagline}</p> : null}
      </CardBody>
      {typeof projectCount === 'number' ? (
        <CardFooter>
          <Meta as="span">
            <Bidi>{formatNumber(projectCount, locale)}</Bidi> {dict.contentUi.programmeProjectsCount}
          </Meta>
        </CardFooter>
      ) : null}
    </Card>
  );
}

// ── Story ────────────────────────────────────────────────────────────────

export function StoryCard({
  story,
  locale,
  dict,
}: {
  story: {
    id: string;
    slug: string;
    title: string | null;
    summary: string | null;
    quote: string | null;
    quoteAttribution: string | null;
    publishedAt: Date | null;
    heroPath: string | null;
    heroAlt: string | null;
    heroBlur: string | null;
  };
  locale: Locale;
  dict: Dictionary;
}) {
  const href = localePath(locale, `/impact/stories/${story.slug}`);

  return (
    <Card as="article" interactive className="w-full">
      <CardMedia>
        <Figure
          image={mediaImage(story.heroPath, story.heroBlur)}
          alt={story.heroAlt ?? ''}
          decorative={!story.heroAlt}
          sizes={CARD_SIZES}
          fallbackLabel={dict.contentUi.noImage}
        />
      </CardMedia>
      <CardBody>
        <Eyebrow>{dict.impact.storiesTitle}</Eyebrow>
        <Heading level={3} size="h3" className="mbs-2">
          <Link href={href} className={titleLink}>
            {story.title}
          </Link>
        </Heading>
        {story.quote ? (
          // The gold rule on the leading edge marks a quotation — logical,
          // so it lands on the right in Arabic and the left in English.
          <blockquote className="mbs-4 border-s-2 border-gold-600 ps-4 text-body text-ink">
            <p>{story.quote}</p>
            {story.quoteAttribution ? (
              <footer className="mbs-2">
                <Meta as="span">— {story.quoteAttribution}</Meta>
              </footer>
            ) : null}
          </blockquote>
        ) : story.summary ? (
          <p className="mbs-3 line-clamp-3 text-small text-ink-70">{story.summary}</p>
        ) : null}
      </CardBody>
      <CardFooter>
        <Link href={href} className="text-small font-medium">
          {dict.contentUi.readStory}
        </Link>
        {story.publishedAt ? (
          <Meta as="span">
            <time dateTime={story.publishedAt.toISOString()}>
              <DateText locale={locale}>{formatDate(story.publishedAt, locale)}</DateText>
            </time>
          </Meta>
        ) : null}
      </CardFooter>
    </Card>
  );
}
