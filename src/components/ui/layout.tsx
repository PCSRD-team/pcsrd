import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Eyebrow, Lede } from './typography';

/**
 * Layout primitives.
 *
 * Everything here obeys the same three constraints from the design system:
 * **radius 0, no shadows, three rule weights**. Hierarchy comes from rules and
 * ground colour, never from elevation. A fourth rule weight or a shadow added
 * here would propagate to every screen at once, which is exactly why they live
 * in one file.
 */

type BlockTag = 'div' | 'section' | 'article' | 'aside' | 'header' | 'footer' | 'nav' | 'main' | 'ul' | 'ol' | 'li';

// ── Container ────────────────────────────────────────────────────────────

const styles = {
  container: {
    /** 1180px + 64px desktop / 20px mobile side gutters. */
    default: 'container-content',
    /** A form, a legal page, a receipt — 760px, inside the same gutters. */
    narrow: 'container-content max-w-narrow',
    /** Full bleed inside the gutters; the max width is the viewport. */
    wide: 'w-full px-5 md:px-16',
  },
  section: {
    tone: {
      default: '',
      alt: 'bg-paper-alt',
      inverse: 'bg-navy-900 text-paper',
    },
    spacing: {
      default: 'section-gap',
      tight: 'py-8 md:py-12',
      none: '',
    },
  },
  gap: {
    0: 'gap-0',
    1: 'gap-1',
    2: 'gap-2',
    3: 'gap-3',
    4: 'gap-4',
    5: 'gap-5',
    6: 'gap-6',
    8: 'gap-8',
    10: 'gap-10',
    12: 'gap-12',
    16: 'gap-16',
  },
  align: {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    baseline: 'items-baseline',
    stretch: 'items-stretch',
  },
  justify: {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
  },
  cols: {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    /** Sidebar layout: content column + a narrower aside from `lg`. */
    sidebar: 'grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]',
  },
  rule: {
    /** 1px `rule` — container edge, list separator. */
    edge: 'border-bs border-rule',
    /** 2px ink — a new record begins. */
    section: 'rule-section',
    /** 2px × 88px gold — the heading mark. */
    mark: 'rule-mark border-0',
  },
};

export type Gap = keyof typeof styles.gap;

export function Container({
  children,
  size = 'default',
  as: Tag = 'div',
  className,
  id,
}: {
  children: ReactNode;
  size?: keyof typeof styles.container;
  as?: BlockTag;
  className?: string;
  id?: string;
}) {
  return (
    <Tag id={id} className={cn(styles.container[size], className)}>
      {children}
    </Tag>
  );
}

// ── Section ──────────────────────────────────────────────────────────────

/**
 * A page section. `bounded` draws the 2px ink rule along the block-start
 * edge: a new record begins here. Pass `labelledBy` with the id of the
 * heading inside it so the section is named in the accessibility tree.
 */
export function Section({
  children,
  className,
  bounded = true,
  tone = 'default',
  spacing = 'default',
  id,
  labelledBy,
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  bounded?: boolean;
  tone?: keyof typeof styles.section.tone;
  spacing?: keyof typeof styles.section.spacing;
  id?: string;
  labelledBy?: string;
  as?: 'section' | 'div' | 'article' | 'aside';
}) {
  return (
    <Tag
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        styles.section.spacing[spacing],
        styles.section.tone[tone],
        bounded && 'rule-section',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

// ── Stack / Cluster / Grid ───────────────────────────────────────────────

/** Vertical rhythm: children stacked on the block axis with one gap. */
export function Stack({
  children,
  gap = 4,
  as: Tag = 'div',
  align,
  className,
}: {
  children: ReactNode;
  gap?: Gap;
  as?: BlockTag;
  align?: keyof typeof styles.align;
  className?: string;
}) {
  return (
    <Tag className={cn('flex flex-col', styles.gap[gap], align && styles.align[align], className)}>
      {children}
    </Tag>
  );
}

/** Inline group that wraps: badges, actions, meta rows. */
export function Cluster({
  children,
  gap = 3,
  align = 'center',
  justify = 'start',
  as: Tag = 'div',
  className,
}: {
  children: ReactNode;
  gap?: Gap;
  align?: keyof typeof styles.align;
  justify?: keyof typeof styles.justify;
  as?: BlockTag;
  className?: string;
}) {
  return (
    <Tag
      className={cn(
        'flex flex-wrap',
        styles.gap[gap],
        styles.align[align],
        styles.justify[justify],
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** Responsive grid — single column on the design's base viewport, then up. */
export function Grid({
  children,
  cols = 3,
  gap = 6,
  as: Tag = 'div',
  className,
}: {
  children: ReactNode;
  cols?: keyof typeof styles.cols;
  gap?: Gap;
  as?: BlockTag;
  className?: string;
}) {
  return (
    <Tag className={cn('grid', styles.cols[cols], styles.gap[gap], className)}>{children}</Tag>
  );
}

// ── Rule ─────────────────────────────────────────────────────────────────

/**
 * One of the three rule weights, and nothing else. `weight` is the whole
 * API: there is no colour prop, no thickness prop, because a rule in this
 * system always says one of three things.
 *
 * Renders `<hr>` by default (a thematic break, announced as a separator).
 * Use `as="span"` inside a heading block where a separator would be noise.
 */
export function Rule({
  weight = 'edge',
  as: Tag = 'hr',
  className,
}: {
  weight?: keyof typeof styles.rule;
  as?: 'hr' | 'div' | 'span';
  className?: string;
}) {
  const classes = cn(styles.rule[weight], Tag !== 'hr' && 'block', className);
  if (Tag === 'hr') return <hr className={classes} />;
  return <Tag aria-hidden="true" className={classes} />;
}

// ── Headings ─────────────────────────────────────────────────────────────

/**
 * H2 with the 88px gold mark beneath it.
 *
 * The mark is the third rule weight and has one meaning: this is a section
 * heading. It is a `<span>` rather than a border on the heading so its width
 * stays 88px regardless of how long the text is.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  as: Tag = 'h2',
  id,
  className,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lead?: string | null;
  as?: 'h1' | 'h2' | 'h3';
  id?: string;
  className?: string;
  /** A link or button rendered on the inline-end side of the heading row. */
  actions?: ReactNode;
}) {
  return (
    <div className={cn('mbe-8', className)}>
      {eyebrow ? <Eyebrow className="mbe-3">{eyebrow}</Eyebrow> : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Tag
            id={id}
            className={cn(
              'font-semibold text-ink',
              Tag === 'h1' ? 'text-h1' : Tag === 'h2' ? 'text-h2' : 'text-h3',
            )}
          >
            {title}
          </Tag>
          <Rule weight="mark" as="span" className="mbs-3" />
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      {lead ? <Lede className="mbs-5">{lead}</Lede> : null}
    </div>
  );
}

/**
 * The page header: eyebrow in mono, the page's one `<h1>`, the gold mark and
 * the lede. This is the only component in the kit that emits an `<h1>`, and
 * it does so because a page header *is* the request for one.
 *
 * `breadcrumbs` renders above the eyebrow; `meta` (a date, a reference code,
 * a status badge) below the title; `actions` on the inline-end side.
 */
export function PageHeader({
  eyebrow,
  title,
  lede,
  breadcrumbs,
  meta,
  actions,
  as: Tag = 'h1',
  id,
  className,
  style,
}: {
  eyebrow?: string;
  title: string;
  lede?: string | null;
  breadcrumbs?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  as?: 'h1' | 'h2';
  id?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <header className={cn('mbe-10', className)} style={style}>
      {breadcrumbs ? <div className="mbe-6">{breadcrumbs}</div> : null}
      {eyebrow ? <Eyebrow className="mbe-3">{eyebrow}</Eyebrow> : null}

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <Tag id={id} className="text-h1 font-semibold text-ink text-balance">
            {title}
          </Tag>
          <Rule weight="mark" as="span" className="mbs-4" />
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      {meta ? <div className="mbs-4">{meta}</div> : null}
      {lede ? <Lede className="mbs-5">{lede}</Lede> : null}
    </header>
  );
}
