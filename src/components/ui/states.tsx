import type { ReactNode } from 'react';
import { Panel } from './primitives';

/**
 * The four states every list must have a designed answer for
 * (`docs/design_handoff/design/PCSRD States & Audit.dc.html`).
 *
 * They live together because the failure they prevent is a list that renders
 * nothing at all and leaves a reader unable to tell "there is no content yet"
 * from "this is broken".
 */

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Panel tone="alt" className="text-center">
      <p className="text-h3 font-semibold text-ink">{title}</p>
      <p className="mbs-3 text-small text-ink-55">{body}</p>
      {action ? <div className="mbs-6">{action}</div> : null}
    </Panel>
  );
}

export function ErrorState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Panel tone="gold" className="text-center">
      <p className="text-h3 font-semibold text-ink">{title}</p>
      <p className="mbs-3 text-small text-ink-70">{body}</p>
      {action ? <div className="mbs-6">{action}</div> : null}
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
 */
export function UntranslatedNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rule-edge mbe-8 border-gold-600 bg-gold-050 p-4">
      <p className="text-small font-medium text-ink">{title}</p>
      <p className="mbs-1 text-caption text-ink-70">{body}</p>
    </div>
  );
}

/**
 * Loading skeleton.
 *
 * Rules and ground colour only — no shimmer animation. The design system has
 * no shadows and no motion vocabulary, and a pulsing grey block would be the
 * only animated thing on the site.
 */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="space-y-4" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="rule-edge bg-paper p-6">
          <div className="h-3 w-24 bg-rule" />
          <div className="mbs-4 h-5 w-2/3 bg-rule-strong" />
          <div className="mbs-3 h-3 w-full bg-rule" />
        </li>
      ))}
    </ul>
  );
}
