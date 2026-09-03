import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
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

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('loading-surface', className)} aria-hidden="true" />;
}

export function PageHeaderSkeleton() {
  return (
    <div className="mbe-8" aria-hidden="true">
      <SkeletonBlock className="h-3 w-24" />
      <SkeletonBlock className="mbs-4 h-8 w-2/5 min-w-48" />
      <SkeletonBlock className="mbs-4 h-4 w-3/5 max-w-xl" />
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <article className="container-content section-gap" aria-busy="true">
      <PageHeaderSkeleton />
      <SkeletonBlock className="mbs-10 aspect-[16/9] w-full" />
      <div className="measure mbs-10 space-y-3" aria-hidden="true">
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-11/12" />
        <SkeletonBlock className="h-4 w-4/5" />
        <SkeletonBlock className="mbs-6 h-4 w-full" />
        <SkeletonBlock className="h-4 w-2/3" />
      </div>
    </article>
  );
}

export function AdminPageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      <div className="grid gap-4 md:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="rule-edge bg-paper p-6">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="mbs-4 h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="rule-edge bg-paper" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="grid gap-4 border-be border-hairline p-4 md:grid-cols-4">
            <SkeletonBlock className="h-4 w-2/3" />
            <SkeletonBlock className="h-4 w-1/2" />
            <SkeletonBlock className="h-4 w-3/4" />
            <SkeletonBlock className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The whole-route loading state for a list page.
 *
 * `ListSkeleton` existed, was designed, and had **zero call sites** — there was
 * no `loading.tsx` anywhere in the app, so non-negotiable #10 ("every list has
 * designed loading, empty, error and untranslated states") was three-quarters
 * met. Empty and untranslated were wired; loading and error were not.
 *
 * It went unnoticed because every route carries `revalidate = 3600`, so a
 * developer on a warm cache never sees a slow render. On a filtered or
 * congested connection — the audience this codebase's own comments cite — a
 * navigation to `/ar/news` showed the *previous* page until the server
 * answered, with nothing to indicate anything was happening.
 *
 * The heading block is a skeleton too, not real text: the title comes from the
 * dictionary and `loading.tsx` cannot read `params` to know the locale, so
 * rendering an Arabic heading on an English route would be worse than
 * rendering none.
 */
export function ListPageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="container-content section-gap" aria-busy="true">
      <div className="mbe-8" aria-hidden="true">
        <div className="rule-mark" />
        <SkeletonBlock className="mbs-4 h-8 w-2/5 min-w-48" />
        <SkeletonBlock className="mbs-4 h-4 w-3/5 max-w-xl" />
      </div>
      <ListSkeleton rows={rows} />
    </div>
  );
}
