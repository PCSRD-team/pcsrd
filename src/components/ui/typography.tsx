import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Typography.
 *
 * Arabic sets the measure: sizes and leading are tuned for the Arabic cut and
 * the Latin cut adapts (`:lang(ar)` / `:lang(en)` in globals.css). Nothing
 * here sets a `dir` — the document direction is the page's, and the only
 * exceptions (a Latin run inside Arabic) go through `Bidi` in `bidi.tsx`.
 */

const styles = {
  prose: {
    /** 68ch — body copy. */
    default: 'measure',
    /** 74ch — long-form reading (legal, strategy). */
    reading: 'measure-reading',
    /** 52ch — a lede or a short introduction. */
    lead: 'measure-lead',
  },
  heading: {
    h1: 'text-h1',
    h2: 'text-h2',
    h3: 'text-h3',
    h4: 'text-h4',
  },
};

/**
 * Mono eyebrow label: `11–12px`, tracked, uppercase for Latin. Never below
 * 11px, never a heading — it labels the heading that follows it.
 */
export function Eyebrow({
  children,
  as: Tag = 'p',
  className,
  id,
}: {
  children: ReactNode;
  as?: 'p' | 'span' | 'div' | 'dt';
  className?: string;
  id?: string;
}) {
  return (
    <Tag id={id} className={cn('eyebrow', className)}>
      {children}
    </Tag>
  );
}

/** The 18px introduction under a page or section title, 52ch wide. */
export function Lede({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <p id={id} className={cn('measure-lead text-lead text-ink-70', className)}>
      {children}
    </p>
  );
}

/** Constrains a text column to the 52–78ch measure. */
export function Prose({
  children,
  className,
  measure = 'default',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  measure?: keyof typeof styles.prose;
  as?: 'div' | 'section' | 'article';
}) {
  return (
    <Tag className={cn(styles.prose[measure], 'space-y-4 text-body text-ink-70', className)}>
      {children}
    </Tag>
  );
}

/**
 * A heading below the page's `<h1>`. Level and size are separate on purpose:
 * a card title is an `h3` in the outline but reads at `h4` size.
 */
export function Heading({
  children,
  level,
  size,
  id,
  className,
}: {
  children: ReactNode;
  level: 2 | 3 | 4 | 5 | 6;
  size?: keyof typeof styles.heading;
  id?: string;
  className?: string;
}) {
  const Tag = `h${level}` as const;
  const resolved = size ?? (level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4');
  return (
    <Tag id={id} className={cn(styles.heading[resolved], 'font-semibold text-ink text-balance', className)}>
      {children}
    </Tag>
  );
}

/** Secondary text: captions, credits, help lines. */
export function Caption({
  children,
  as: Tag = 'p',
  className,
  id,
}: {
  children: ReactNode;
  as?: 'p' | 'span' | 'div';
  className?: string;
  id?: string;
}) {
  return (
    <Tag id={id} className={cn('text-caption text-ink-55', className)}>
      {children}
    </Tag>
  );
}

/**
 * Mono meta line: a date, a reference, a count. Inherits direction from the
 * page; wrap Latin runs in `Bidi`/`Code` at the call site.
 */
export function Meta({
  children,
  as: Tag = 'p',
  className,
  id,
}: {
  children: ReactNode;
  as?: 'p' | 'span' | 'div';
  className?: string;
  id?: string;
}) {
  return (
    <Tag id={id} className={cn('type-meta', className)}>
      {children}
    </Tag>
  );
}
