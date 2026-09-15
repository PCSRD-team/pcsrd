import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { LinkPendingMark } from './link-pending';

/**
 * Actions.
 *
 * Four tones, three sizes, one shape: **radius 0, no shadow, no lift.**
 * Hover darkens the ground one step. Focus is the global two-tone ring in
 * globals.css. Every size keeps the 44px minimum touch target — `sm` trims the
 * padding and type, never the hit area.
 *
 * Gold appears in exactly one tone, `marked`, and as a rule beneath the label,
 * never as a fill and never as text.
 */

const styles = {
  base:
    'inline-flex min-h-target items-center justify-center gap-2 font-medium no-underline ' +
    'motion-standard transition-colors disabled:cursor-not-allowed disabled:opacity-60',
  size: {
    sm: 'px-4 py-2 text-caption',
    md: 'px-6 py-3 text-small',
    lg: 'px-8 py-4 text-body',
  },
  tone: {
    /** Navy fill, paper text — the one action a screen is for. */
    primary: 'bg-navy-700 text-paper hover:bg-navy-900 hover:text-paper',
    /** 1px navy outline, navy text. */
    secondary:
      'border border-navy-700 bg-transparent text-navy-700 hover:bg-navy-100 hover:text-navy-900',
    /** No edge; for toolbars and dense rows. */
    quiet: 'bg-transparent text-ink hover:bg-paper-alt hover:text-ink',
    /** Destructive: outlined, never filled — a red fill is a shout. */
    danger:
      'border border-destructive/40 bg-transparent text-destructive hover:bg-destructive-soft hover:text-destructive',
    /** Gold as a marking colour: a 2px rule under the label, ink text. */
    marked:
      'border-b-2 border-gold-600 bg-transparent px-1 text-ink hover:bg-gold-050 hover:text-gold-700',
  },
  icon: {
    sm: 'min-h-target min-w-target p-2',
    md: 'min-h-target min-w-target p-3',
    lg: 'min-h-14 min-w-14 p-4',
  },
};

export type ButtonTone = keyof typeof styles.tone | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = keyof typeof styles.size;

/** Older tone names still resolve; new code uses the four canonical ones. */
function resolveTone(tone: ButtonTone): keyof typeof styles.tone {
  if (tone === 'outline') return 'secondary';
  if (tone === 'ghost') return 'quiet';
  if (tone === 'destructive') return 'danger';
  return tone;
}

/** The class string a button or link-as-button wears; exported for the rare
 *  element that must be neither (a `<summary>`, a `<label>` on a file input). */
export function buttonClasses({
  tone = 'primary',
  size = 'md',
  className,
}: {
  tone?: ButtonTone;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(styles.base, styles.size[size], styles.tone[resolveTone(tone)], className);
}

type NativeButton = Omit<ComponentPropsWithoutRef<'button'>, 'className' | 'children'>;

export function Button({
  children,
  tone = 'primary',
  size = 'md',
  type = 'button',
  className,
  disabled,
  loading,
  ...rest
}: NativeButton & {
  children: ReactNode;
  tone?: ButtonTone;
  size?: ButtonSize;
  className?: string;
  /** Disables the control and sets `aria-busy`; the label is the caller's. */
  loading?: boolean;
}) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ tone, size, className })}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  tone = 'primary',
  size = 'md',
  className,
  external,
  download,
  pendingMark,
  ariaLabel,
  ariaCurrent,
}: {
  children: ReactNode;
  href: string;
  tone?: ButtonTone;
  size?: ButtonSize;
  className?: string;
  /** Opens in a new tab with `rel="noopener noreferrer"`. */
  external?: boolean;
  download?: boolean;
  /** Show the gold pending mark while the client navigation is in flight. */
  pendingMark?: boolean;
  ariaLabel?: string;
  ariaCurrent?: 'page' | 'step' | 'true';
}) {
  const classes = buttonClasses({ tone, size, className });
  if (external || download) {
    return (
      <a
        href={href}
        className={classes}
        aria-label={ariaLabel}
        download={download || undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        target={external ? '_blank' : undefined}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} aria-label={ariaLabel} aria-current={ariaCurrent}>
      {children}
      {pendingMark ? <LinkPendingMark /> : null}
    </Link>
  );
}

/**
 * Icon-only button. `label` is required and becomes the accessible name; the
 * icon inside is decorative. Square, 44px minimum.
 */
export function IconButton({
  children,
  label,
  tone = 'quiet',
  size = 'md',
  type = 'button',
  className,
  ...rest
}: NativeButton & {
  children: ReactNode;
  label: string;
  tone?: ButtonTone;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      className={cn(
        styles.base,
        styles.icon[size],
        styles.tone[resolveTone(tone)],
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Icon-only link, same contract as `IconButton`. */
export function IconLink({
  children,
  label,
  href,
  tone = 'quiet',
  size = 'md',
  className,
  external,
}: {
  children: ReactNode;
  label: string;
  href: string;
  tone?: ButtonTone;
  size?: ButtonSize;
  className?: string;
  external?: boolean;
}) {
  const classes = cn(styles.base, styles.icon[size], styles.tone[resolveTone(tone)], className);
  if (external) {
    return (
      <a href={href} className={classes} aria-label={label} rel="noopener noreferrer" target="_blank">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} aria-label={label}>
      {children}
    </Link>
  );
}

/** A 20px slot that keeps an icon vertically centred beside a label. */
export function IconSlot({ children }: { children: ReactNode }) {
  return (
    <span className="icon-20 inline-flex shrink-0 items-center justify-center" aria-hidden="true">
      {children}
    </span>
  );
}
