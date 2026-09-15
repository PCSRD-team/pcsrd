import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Panel } from './card';
import { Notice } from './notice';

/**
 * The four states every list must have a designed answer for
 * (`docs/design_handoff/design/PCSRD States & Audit.dc.html`).
 *
 * They live together because the failure they prevent is a list that renders
 * nothing at all and leaves a reader unable to tell "there is no content yet"
 * from "this is broken". Every state has a route out: an action slot, a link
 * back, a way to widen the filter.
 */

/**
 * Nothing here — yet, or for these filters. `title` says which; `body`
 * says what to do about it; `action` is the way out. Centred on the
 * alternate paper, opening with the 2px rule when it stands in for a whole
 * section (`bounded`).
 */
export function EmptyState({
  title,
  body,
  action,
  bounded,
  footnote,
  className,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  /** Opens with the 2px section rule instead of the 1px edge. */
  bounded?: boolean;
  /** A quiet line under the actions — "we never charge a fee to apply". */
  footnote?: string;
  className?: string;
}) {
  return (
    <Panel
      tone="alt"
      padding="lg"
      className={cn('text-center', bounded && 'rule-section', className)}
    >
      <p className="text-h3 font-semibold text-ink text-balance">{title}</p>
      <p className="measure-lead mx-auto mbs-3 text-small text-ink-55">{body}</p>
      {action ? <div className="mbs-6 flex flex-wrap justify-center gap-3">{action}</div> : null}
      {footnote ? <p className="mbs-6 text-caption text-mono-muted">{footnote}</p> : null}
    </Panel>
  );
}

/**
 * Something failed on our side. A 2px destructive rule opens it — the one
 * place that colour appears at rule weight — and the reference, when given,
 * is mono and isolated so it can be read back over the phone.
 */
export function ErrorState({
  title,
  body,
  action,
  reference,
  referenceLabel,
  className,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  /** Error reference for support — never personal data. */
  reference?: string | null;
  /** The label before the reference, from the dictionary. */
  referenceLabel?: string;
  className?: string;
}) {
  return (
    <Panel tone="paper" padding="lg" as="section" className={cn(className)}>
      <span className="block h-0.5 w-18 bg-destructive" aria-hidden="true" />
      <p className="mbs-5 text-h3 font-semibold text-ink text-balance">{title}</p>
      <p className="measure mbs-3 text-small text-ink-70">{body}</p>
      {action ? <div className="mbs-6 flex flex-wrap gap-3">{action}</div> : null}
      {reference ? (
        <p className="mbs-6 border-bs border-rule pbs-4 font-mono text-eyebrow text-mono-muted">
          {referenceLabel ? <span>{referenceLabel} </span> : null}
          <bdi dir="ltr">{reference}</bdi>
        </p>
      ) : null}
    </Panel>
  );
}

/**
 * Shown when a page exists in the requested locale but its content does not.
 *
 * Without it, an English reader gets Arabic body text with no explanation and
 * concludes the site is broken rather than incomplete — which is the more
 * damaging of the two readings for an organisation whose main job here is
 * looking credible.
 *
 * Gold accent: this is an attestation of sorts — "this is the original".
 * `live="off"`: it is page content, not a response to an action.
 */
export function UntranslatedNotice({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body: string;
  /** A link to the Arabic original and/or back to the list. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Notice tone="warning" title={title} actions={action} live="off" className={cn('mbe-8', className)}>
      {body}
    </Notice>
  );
}

/**
 * The receipt after a successful submission: the reference number set large
 * and isolated so it can be copied or read aloud. `role="status"` so the
 * result is announced when the form is replaced by it.
 */
export function SubmissionReceipt({
  title,
  reference,
  body,
  action,
  className,
}: {
  title: string;
  reference: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Panel tone="gold" role="status" className={cn('border-gold-600', className)}>
      <p className="text-small font-medium text-ink">{title}</p>
      <p className="mbs-3 font-mono text-h3 text-ink" dir="ltr">
        {reference}
      </p>
      {body ? <p className="mbs-3 text-caption text-ink-70">{body}</p> : null}
      {action ? <div className="mbs-5 flex flex-wrap gap-3">{action}</div> : null}
    </Panel>
  );
}
