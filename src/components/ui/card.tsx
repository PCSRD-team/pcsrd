import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Surfaces.
 *
 * `Panel` is a paper surface with the 1px edge rule: the identity record, a
 * form, a receipt. `Card` is the same surface for a *record in a list* — a
 * project, a story, a vacancy — with an optional programme accent along its
 * block-start edge and optional hover treatment when the whole card is a
 * link target.
 *
 * "Cards only where content is genuinely a card" (design principle 2). A
 * paragraph of prose does not go in a card; a section does not go in a card.
 * Radius 0, no shadow — elevation is the rule and the ground colour.
 */

const styles = {
  tone: {
    paper: 'bg-paper text-ink',
    alt: 'bg-paper-alt text-ink',
    /** The attestation ground — a verified figure, a signed statement. */
    gold: 'bg-gold-050 text-ink',
    navy: 'bg-navy-900 text-paper',
    /** Inputs sit on white; a panel that holds a form does too. */
    white: 'bg-white text-ink',
  },
  padding: {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6 md:p-8',
    lg: 'p-8 md:p-10',
  },
};

type SurfaceTag = 'div' | 'article' | 'section' | 'aside' | 'li' | 'figure';

/** Paper surface with the 1px container-edge rule. */
export function Panel({
  children,
  className,
  tone = 'paper',
  padding = 'md',
  as: Tag = 'div',
  id,
  labelledBy,
  role,
}: {
  children: ReactNode;
  className?: string;
  tone?: keyof typeof styles.tone;
  padding?: keyof typeof styles.padding;
  as?: SurfaceTag;
  id?: string;
  labelledBy?: string;
  /** `status` for a result panel, `region` with `labelledBy` for a landmark. */
  role?: 'status' | 'region' | 'group' | 'note';
}) {
  return (
    <Tag
      id={id}
      role={role}
      aria-labelledby={labelledBy}
      className={cn('rule-edge', styles.padding[padding], styles.tone[tone], className)}
    >
      {children}
    </Tag>
  );
}

/**
 * A record in a list.
 *
 * `accent` takes a CSS colour (normally `var(--color-prog-protection)` or a
 * programme's stored hex) and draws it as the 2px block-start rule — the
 * section-boundary weight in the programme colour, not a new weight.
 *
 * `interactive` adds the hover ground change for a card whose title is a
 * link. The card itself is never the link: that would make its text
 * unselectable and swallow any control inside it. Put the link on the
 * title and, if the whole surface should be clickable, extend it with
 * `after:absolute after:inset-0` on the link and `relative` on the card.
 */
export function Card({
  children,
  className,
  tone = 'paper',
  padding = 'md',
  accent,
  interactive,
  as: Tag = 'article',
  id,
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  tone?: keyof typeof styles.tone;
  padding?: keyof typeof styles.padding;
  /** A CSS colour for the programme accent rule. */
  accent?: string | null;
  interactive?: boolean;
  as?: SurfaceTag;
  id?: string;
  labelledBy?: string;
}) {
  const style = accent ? ({ '--accent': accent } as CSSProperties) : undefined;
  return (
    <Tag
      id={id}
      aria-labelledby={labelledBy}
      style={style}
      className={cn(
        'relative flex flex-col',
        accent ? 'rule-accent' : 'rule-edge',
        styles.tone[tone],
        styles.padding[padding],
        interactive && 'interactive-surface',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * The image slot at the top of a card. Renders the child (normally a
 * `Figure` with `fill`) inside a fixed aspect box so the layout does not
 * shift while the image loads — and holds its shape when there is no image
 * at all, which is the common case at launch.
 */
export function CardMedia({
  children,
  ratio = 'wide',
  className,
}: {
  children: ReactNode;
  ratio?: 'wide' | 'square' | 'portrait';
  className?: string;
}) {
  const ratios = {
    wide: 'aspect-video',
    square: 'aspect-square',
    portrait: 'aspect-[4/5]',
  };
  return (
    <div
      className={cn(
        'media-treatment relative -mx-6 -mbs-6 mbe-6 md:-mx-8 md:-mbs-8',
        ratios[ratio],
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Body of a card: grows to push the footer down in a grid of equal heights. */
export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex-1', className)}>{children}</div>;
}

/** Footer row of a card, separated by the 1px hairline. */
export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'mbs-6 flex flex-wrap items-center justify-between gap-3 border-bs border-hairline pbs-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A row in a ruled list: the 404 links, a channel list, a document list.
 * Each row is separated by the 1px rule; the whole list opens with the 2px
 * section rule when `bounded`.
 */
export function RuledList({
  children,
  bounded,
  as: Tag = 'ul',
  className,
  labelledBy,
}: {
  children: ReactNode;
  bounded?: boolean;
  as?: 'ul' | 'ol' | 'div';
  className?: string;
  labelledBy?: string;
}) {
  return (
    <Tag aria-labelledby={labelledBy} className={cn(bounded ? 'rule-section' : 'border-bs border-rule', className)}>
      {children}
    </Tag>
  );
}

export function RuledListItem({
  children,
  as: Tag = 'li',
  className,
}: {
  children: ReactNode;
  as?: 'li' | 'div';
  className?: string;
}) {
  return (
    <Tag className={cn('flex min-h-target flex-wrap items-center gap-4 border-be border-rule py-3', className)}>
      {children}
    </Tag>
  );
}
