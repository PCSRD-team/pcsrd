import Image from 'next/image';
import Link from 'next/link';
import { Badge, Panel } from '@/components/ui/primitives';
import { Bidi, DateText } from '@/components/ui/bidi';
import { publicEnv } from '@/lib/env.public';
import { formatDate, formatNumber, formatPeriod, storageUrl } from '@/lib/format';
import type { Dictionary } from '@/lib/i18n/get-dictionary';
import { type Locale, localePath } from '@/lib/i18n/config';

/**
 * Cards.
 *
 * Every one of these must render correctly with **no image**. The designs use
 * placeholder frames throughout because the organisation does not hold photo
 * consent for most of its work, so an absent hero is the normal case, not the
 * degraded one.
 */

function Cover({
  path,
  alt,
  blur,
  className,
}: {
  path: string | null;
  alt: string | null;
  blur?: string | null;
  className?: string;
}) {
  if (!path) {
    // Not a grey box with a broken-image icon: a ruled frame, which is what the
    // design uses and which reads as "no photograph" rather than "failed".
    return <div className={`rule-edge bg-paper-alt ${className ?? ''}`} aria-hidden="true" />;
  }
  return (
    <div className={`relative overflow-hidden bg-paper-alt ${className ?? ''}`}>
      <Image
        src={storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, 'media', path)}
        alt={alt ?? ''}
        fill
        sizes="(min-width: 768px) 380px, 100vw"
        placeholder={blur ? 'blur' : 'empty'}
        blurDataURL={blur ?? undefined}
        className="object-cover"
      />
    </div>
  );
}

// ── Project ──────────────────────────────────────────────────────────────

const PROJECT_STATE_TONE = {
  active: 'active',
  completed: 'complete',
  planned: 'planned',
} as const;

const projectStateLabel = (
  state: 'planned' | 'active' | 'completed',
  dict: Dictionary,
): string =>
  ({
    planned: dict.projects.statePlanned,
    active: dict.projects.stateActive,
    completed: dict.projects.stateCompleted,
  })[state];

export function ProjectCard({
  project,
  locale,
  dict,
}: {
  project: {
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
  locale: Locale;
  dict: Dictionary;
}) {
  const period = formatPeriod(project.startDate, project.endDate, locale);

  return (
    <Panel as="article" className="flex flex-col gap-4 p-0">
      <Cover
        path={project.heroPath}
        alt={project.heroAlt}
        blur={project.heroBlur}
        className="aspect-[16/9]"
      />
      <div className="flex flex-1 flex-col gap-3 p-6 pbs-0">
        <p className="eyebrow">{project.programTitle}</p>
        <h3 className="text-h3 font-semibold">
          <Link
            href={localePath(locale, `/projects/${project.slug}`)}
            className="text-ink no-underline hover:text-gold-700"
          >
            {project.title}
          </Link>
        </h3>
        {project.summary ? (
          <p className="line-clamp-3 text-small text-ink-70">{project.summary}</p>
        ) : null}
        <div className="mbs-auto flex flex-wrap items-center gap-3 pbs-2">
          <Badge tone={PROJECT_STATE_TONE[project.state]}>
            {projectStateLabel(project.state, dict)}
          </Badge>
          {period ? (
            <span className="font-mono text-caption text-mono-muted">
              <Bidi>{period}</Bidi>
            </span>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

// ── Post ─────────────────────────────────────────────────────────────────

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
  const categoryLabel = {
    news: dict.news.categoryNews,
    statement: dict.news.categoryStatement,
    announcement: dict.news.categoryAnnouncement,
  }[post.category];

  return (
    <Panel as="article" className="flex gap-5 p-0">
      <Cover
        path={post.heroPath}
        alt={post.heroAlt}
        blur={post.heroBlur}
        className="hidden aspect-square w-40 shrink-0 sm:block"
      />
      <div className="flex flex-1 flex-col gap-2 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow">{categoryLabel}</p>
          {post.publishedAt ? (
            <time
              dateTime={post.publishedAt.toISOString()}
              className="font-mono text-caption text-mono-muted"
            >
              <DateText locale={locale}>{formatDate(post.publishedAt, locale)}</DateText>
            </time>
          ) : null}
        </div>
        <h3 className="text-h3 font-semibold">
          <Link
            href={localePath(locale, `/news/${post.slug}`)}
            className="text-ink no-underline hover:text-gold-700"
          >
            {post.title}
          </Link>
        </h3>
        {post.excerpt ? (
          <p className="line-clamp-2 text-small text-ink-70">{post.excerpt}</p>
        ) : null}
      </div>
    </Panel>
  );
}

// ── Impact metric ────────────────────────────────────────────────────────

/**
 * A published figure **always** renders with its period and verification
 * status. There is no prop that turns either off — the rule is enforced by the
 * component having no way to express the alternative.
 */
export function MetricCard({
  metric,
  locale,
  dict,
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
}) {
  const statusLabel = {
    verified: dict.impact.verified,
    reported: dict.impact.reported,
    target: dict.impact.target,
  }[metric.status];

  return (
    <Panel as="li" tone={metric.status === 'verified' ? 'gold' : 'paper'} className="flex flex-col gap-2">
      <p className="text-h1 font-semibold text-ink">
        <Bidi>
          {metric.displayPrefix ?? ''}
          {formatNumber(metric.value, locale)}
        </Bidi>{' '}
        <span className="text-h3 font-normal text-ink-70">{metric.unit}</span>
      </p>
      <p className="text-small text-ink">{metric.label}</p>

      <dl className="mbs-2 space-y-1 border-bs border-hairline pbs-3">
        <div className="flex gap-2">
          <dt className="eyebrow">{dict.impact.period}</dt>
          <dd className="font-mono text-caption text-ink-70">
            <DateText locale={locale}>{formatPeriod(metric.periodStart, metric.periodEnd, locale)}</DateText>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="eyebrow">{dict.projects.state}</dt>
          <dd className="text-caption text-ink-70">{statusLabel}</dd>
        </div>
        {metric.verificationSource ? (
          <div className="flex gap-2">
            <dt className="eyebrow">{dict.impact.source}</dt>
            <dd className="text-caption text-ink-70">{metric.verificationSource}</dd>
          </div>
        ) : null}
      </dl>
    </Panel>
  );
}

// ── Vacancy ──────────────────────────────────────────────────────────────

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
  return (
    <Panel as="li" className="flex flex-wrap items-baseline justify-between gap-4">
      <div>
        <h3 className="text-h3 font-semibold">
          <Link
            href={localePath(locale, `/careers/${vacancy.slug}`)}
            className="text-ink no-underline hover:text-gold-700"
          >
            {vacancy.title}
          </Link>
        </h3>
        {vacancy.location ? (
          <p className="mbs-1 text-small text-ink-55">{vacancy.location}</p>
        ) : null}
      </div>
      <p className="font-mono text-caption text-mono-muted">
        {dict.careers.deadline}: <DateText locale={locale}>{formatDate(vacancy.deadline, locale)}</DateText>
      </p>
    </Panel>
  );
}

// ── Programme ────────────────────────────────────────────────────────────

export function ProgramCard({
  program,
  locale,
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
}) {
  return (
    <Panel as="article" className="flex flex-col gap-4 p-0">
      <Cover
        path={program.heroPath}
        alt={program.heroAlt}
        blur={program.heroBlur}
        className="aspect-[16/9]"
      />
      <div className="flex flex-col gap-3 p-6 pbs-0">
        {/*
          Programme identity is a 2px mark in the programme's own colour. It is
          the only place a colour outside ink/gold/paper appears, and it is a
          rule rather than a fill — the same discipline as the gold mark.
        */}
        <span
          className="block h-[2px] w-[88px]"
          style={{ background: `var(${program.accentToken})` }}
          aria-hidden="true"
        />
        <h3 className="text-h3 font-semibold">
          <Link
            href={localePath(locale, `/programs/${program.slug}`)}
            className="text-ink no-underline hover:text-gold-700"
          >
            {program.title}
          </Link>
        </h3>
        {program.tagline ? <p className="text-small text-ink-70">{program.tagline}</p> : null}
      </div>
    </Panel>
  );
}
