import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Bidi, DateText } from './bidi';
import { VerificationBadge, type VerificationStatus } from './badge';

/**
 * An impact figure, locked to its period and its verification status.
 *
 * Design principle 1: evidence over emphasis. The gold rule sits *above* the
 * figure, not under the label — it is the figure that is attested. Period
 * and status are text, in the DOM, not a `title` attribute
 * (04-DESIGN-SYSTEM §5).
 *
 * The lock is enforced twice. The types make `period` and `verification`
 * required, and `canRenderStat` checks at runtime that they are not empty
 * strings — a seed row with `''` for its period would otherwise type-check
 * and ship a bare number, which "Never do" forbids. When the check fails the
 * component renders nothing; a missing figure is a gap a reader can see,
 * a figure without provenance is a claim.
 */

export type StatPeriod = {
  /** ISO dates for `<time dateTime>`. */
  start: string;
  end: string;
  /** The formatted range the reader sees — `formatPeriod()` output. */
  label: string;
};

export type StatVerification = {
  status: VerificationStatus;
  /** The dictionary label for the status. */
  label: string;
  /** Who verified it — shown when present. */
  source?: string | null;
};

export type StatInput = {
  value: string | number;
  period: StatPeriod | null | undefined;
  verification: StatVerification | null | undefined;
};

/** True only when the figure carries a non-empty period and a labelled status. */
export function canRenderStat(input: StatInput): boolean {
  const { value, period, verification } = input;
  if (value === '' || value === null || value === undefined) return false;
  if (typeof value === 'number' && !Number.isFinite(value)) return false;
  if (!period || !period.start.trim() || !period.end.trim() || !period.label.trim()) return false;
  if (!verification || !verification.label.trim()) return false;
  return true;
}

const styles = {
  root: 'border-bs-2 border-gold-600 pbs-4',
  figure: 'flex flex-wrap items-baseline gap-2',
  value: 'text-h1 font-semibold leading-none text-navy-700 tabular-nums',
  unit: 'text-body text-ink-55',
  label: 'mbs-2 text-small font-medium text-ink',
  meta: 'mbs-2 flex flex-wrap items-center gap-x-3 gap-y-1',
  period: 'font-mono text-eyebrow text-ink-55',
  source: 'text-caption text-ink-55',
};

export function Stat({
  value,
  unit,
  label,
  period,
  verification,
  prefix,
  locale,
  as: Tag = 'div',
  className,
  children,
}: {
  /** Already formatted for the locale (`formatNumber`). */
  value: string | number;
  unit?: string | null;
  label: string;
  period: StatPeriod;
  verification: StatVerification;
  /** `+` for "more than", `~` for "approximately". */
  prefix?: '+' | '~' | null;
  locale: 'ar' | 'en';
  as?: 'div' | 'li';
  className?: string;
  /** A footnote slot: methodology link, a caveat. */
  children?: ReactNode;
}) {
  if (!canRenderStat({ value, period, verification })) return null;

  return (
    <Tag className={cn(styles.root, className)}>
      <p className={styles.figure}>
        <Bidi className={styles.value}>
          {prefix ?? ''}
          {value}
        </Bidi>
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </p>
      <p className={styles.label}>{label}</p>
      <div className={styles.meta}>
        <DateText locale={locale} className={styles.period}>
          {/* `datetime` cannot express a range; the start anchors the
              element and the end is exposed as data for consumers. */}
          <time dateTime={period.start} data-period-end={period.end}>
            {period.label}
          </time>
        </DateText>
        <VerificationBadge status={verification.status} label={verification.label} />
        {verification.source ? <span className={styles.source}>{verification.source}</span> : null}
      </div>
      {children ? <div className="mbs-3 text-caption text-ink-55">{children}</div> : null}
    </Tag>
  );
}

/** Backwards-compatible name from the spec's component inventory. */
export const MetricTile = Stat;

/**
 * A row of figures. Each child is a `Stat`; the grid keeps the gold rules
 * aligned, and an odd count does not leave an orphan stretched full width.
 */
export function StatGroup({
  children,
  className,
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <ul aria-labelledby={labelledBy} className={cn('grid gap-8 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {children}
    </ul>
  );
}
