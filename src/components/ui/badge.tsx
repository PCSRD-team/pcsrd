import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Badges.
 *
 * A badge names a state in words; colour is reinforcement, never the signal
 * (04-DESIGN-SYSTEM §5). Square, 1px edge, mono — a chip that reads as a
 * stamp on a record rather than a button. There is no pill: the design
 * system has no radius, and a square status chip beside a square button is
 * told apart by its mono type and its size, not its corners.
 *
 * Gold appears once, on `verified`, as the edge and the ground; the text is
 * `gold-700` (AA on the attestation ground), never `gold-600`.
 */

const styles = {
  base: 'inline-flex max-w-full items-center gap-1.5 border px-2.5 py-0.5 font-mono text-eyebrow tracking-wide',
  tone: {
    neutral: 'border-rule bg-paper-alt text-ink-70',
    active: 'border-navy-700/30 bg-navy-100 text-navy-900',
    complete: 'border-rule-strong bg-paper-alt text-ink-55',
    planned: 'border-rule bg-paper text-ink-55',
    /** The attested stamp. */
    verified: 'border-gold-600 bg-gold-050 text-gold-700',
    success: 'border-success bg-success-soft text-success',
    warning: 'border-warning bg-warning-soft text-warning',
    danger: 'border-destructive bg-destructive-soft text-destructive',
    info: 'border-navy-700/30 bg-navy-100 text-navy-700',
    /** Programme identity: pass `accent` for the colour. */
    accent: 'border-current bg-paper',
  },
  /** The 8px square beside a deadline state — redundant reinforcement. */
  dot: 'inline-block size-2 shrink-0 bg-current',
};

export type BadgeTone = keyof typeof styles.tone;

export function Badge({
  children,
  tone = 'neutral',
  dot,
  accent,
  className,
  uppercase = true,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  /** Draws the small square before the label. */
  dot?: boolean;
  /** A CSS colour used with `tone="accent"` for programme identity. */
  accent?: string | null;
  className?: string;
  /** Latin labels are uppercase by default; Arabic has no case, so it is harmless. */
  uppercase?: boolean;
}) {
  return (
    <span
      className={cn(styles.base, styles.tone[tone], uppercase && 'uppercase', className)}
      style={tone === 'accent' && accent ? { color: accent } : undefined}
    >
      {dot ? <span className={styles.dot} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** Content-record status; the vocabulary of `content_status` in the schema. */
export type ContentStatusValue = 'draft' | 'in_review' | 'published' | 'archived';

const statusTone: Record<ContentStatusValue, BadgeTone> = {
  draft: 'neutral',
  in_review: 'active',
  published: 'verified',
  archived: 'complete',
};

/**
 * A content status. `label` is the caller's — the admin dictionary or the
 * public one — so the kit stays free of copy. `status` is also written to
 * `data-status` so tests and styles can address it without parsing text.
 */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: ContentStatusValue;
  label: string;
  className?: string;
}) {
  return (
    <Badge tone={statusTone[status]} className={className}>
      <span data-status={status}>{label}</span>
    </Badge>
  );
}

/**
 * Verification of an impact figure. Same three values as the metric schema;
 * `target` is deliberately the quietest of the three.
 */
export type VerificationStatus = 'verified' | 'reported' | 'target';

const verificationTone: Record<VerificationStatus, BadgeTone> = {
  verified: 'verified',
  reported: 'neutral',
  target: 'planned',
};

export function VerificationBadge({
  status,
  label,
  className,
}: {
  status: VerificationStatus;
  label: string;
  className?: string;
}) {
  return (
    <Badge tone={verificationTone[status]} className={className}>
      <span data-verification={status}>{label}</span>
    </Badge>
  );
}
