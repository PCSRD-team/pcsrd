import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Icon, type IconName } from './icon';

/**
 * Inline notices.
 *
 * Four tones, each carried by a word (the title), a glyph and a colour —
 * never colour alone. The tone colour is the 2px inline-start accent and
 * the glyph; the ground is the tone's soft tint; the text stays ink so the
 * body reads at AA on every tint.
 *
 * Live-region semantics follow the tone. `danger` is `role="alert"`
 * (assertive: a failed submission must interrupt). The other three are
 * `role="status"` (polite). Override with `live` when a notice is static
 * page content rather than a response to something the reader did — a
 * privacy note beside a form is `live="off"`.
 */

const styles = {
  base: 'rule-accent-start flex gap-3 p-4 text-small text-ink',
  tone: {
    info: 'bg-navy-100',
    success: 'bg-success-soft',
    warning: 'bg-gold-050',
    danger: 'bg-destructive-soft',
  },
  glyph: {
    info: 'text-navy-700',
    success: 'text-success',
    warning: 'text-gold-700',
    danger: 'text-destructive',
  },
  title: 'font-medium text-ink',
  body: 'mbs-1 text-caption text-ink-70',
};

export type NoticeTone = keyof typeof styles.tone;

const accent: Record<NoticeTone, string> = {
  info: 'var(--color-navy-700)',
  success: 'var(--color-success)',
  warning: 'var(--color-gold-600)',
  danger: 'var(--color-destructive)',
};

const glyph: Record<NoticeTone, IconName> = {
  info: 'info',
  success: 'check',
  warning: 'warning',
  danger: 'error',
};

export function Notice({
  tone = 'info',
  title,
  children,
  actions,
  live,
  id,
  className,
}: {
  tone?: NoticeTone;
  title?: string;
  children?: ReactNode;
  /** Links or buttons rendered under the body. */
  actions?: ReactNode;
  /** `off` for static content; defaults to the tone's semantics. */
  live?: 'off' | 'polite' | 'assertive';
  id?: string;
  className?: string;
}) {
  const politeness = live ?? (tone === 'danger' ? 'assertive' : 'polite');
  const role = politeness === 'off' ? undefined : politeness === 'assertive' ? 'alert' : 'status';

  return (
    <div
      id={id}
      role={role}
      style={{ '--accent': accent[tone] } as CSSProperties}
      className={cn(styles.base, styles.tone[tone], className)}
    >
      <span className={cn('mbs-0.5 shrink-0', styles.glyph[tone])}>
        <Icon name={glyph[tone]} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        {title ? <p className={styles.title}>{title}</p> : null}
        {children ? <div className={cn(title && styles.body)}>{children}</div> : null}
        {actions ? <div className="mbs-3 flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}

/** Alias for callers that think in shadcn terms. */
export const Alert = Notice;

/**
 * The polite region a form writes its result into. Always rendered, even
 * when empty, so the region exists in the accessibility tree before the
 * message arrives — an `aria-live` element created at the same moment as its
 * content is not announced.
 */
export function LiveRegion({
  children,
  id,
  assertive,
  className,
}: {
  children?: ReactNode;
  id?: string;
  assertive?: boolean;
  className?: string;
}) {
  return (
    <div
      id={id}
      role={assertive ? 'alert' : 'status'}
      aria-live={assertive ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={className}
    >
      {children}
    </div>
  );
}
