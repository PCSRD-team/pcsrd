import { cn } from '@/lib/utils';

/**
 * Loading skeletons.
 *
 * Rules and ground colour only, with the one quiet sweep `loading-surface`
 * carries (removed under `prefers-reduced-motion`). Each skeleton matches
 * the rule structure of the component it stands in for, so the page does not
 * reflow when the content arrives — that is what makes it a loading *state*
 * and not a spinner.
 *
 * Every skeleton is `aria-hidden` inside an `aria-busy` container; the
 * screen reader hears "busy", not a hundred empty blocks.
 *
 * No text, ever: `loading.tsx` cannot read `params` to know the locale, so
 * rendering an Arabic heading on an English route would be worse than
 * rendering none.
 */

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('loading-surface', className)} aria-hidden="true" />;
}

/** The lines of a paragraph. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  const widths = ['w-full', 'w-11/12', 'w-4/5', 'w-full', 'w-2/3'];
  return (
    <div className={cn('space-y-3', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonBlock key={index} className={cn('h-4', widths[index % widths.length])} />
      ))}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="mbe-10" aria-hidden="true">
      <SkeletonBlock className="h-3 w-24" />
      <SkeletonBlock className="mbs-4 h-9 w-2/5 min-w-48" />
      <div className="rule-mark mbs-4" />
      <SkeletonBlock className="mbs-5 h-4 w-3/5 max-w-xl" />
    </div>
  );
}

/** One ruled card per row — a news list, a vacancy list. */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="space-y-4" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="rule-edge bg-paper p-6">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="mbs-4 h-5 w-2/3" />
          <SkeletonBlock className="mbs-3 h-3 w-full" />
        </li>
      ))}
    </ul>
  );
}

/** A grid of cards with a media slot — projects, stories. */
export function CardGridSkeleton({ count = 6, media = true }: { count?: number; media?: boolean }) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="rule-edge bg-paper">
          {media ? <SkeletonBlock className="aspect-video w-full" /> : null}
          <div className="p-6">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="mbs-4 h-5 w-3/4" />
            <SkeletonBlock className="mbs-3 h-3 w-full" />
            <SkeletonBlock className="mbs-2 h-3 w-5/6" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A table: header band, then ruled rows of `columns` cells. */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  const cellWidths = ['w-2/3', 'w-1/2', 'w-3/4', 'w-1/3', 'w-1/2'];
  return (
    <div className="rule-section bg-paper" aria-hidden="true">
      <div className="flex gap-4 border-be border-rule bg-paper-alt p-3">
        {Array.from({ length: columns }, (_, index) => (
          <SkeletonBlock key={index} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-4 border-be border-hairline p-3">
          {Array.from({ length: columns }, (_, col) => (
            <div key={col} className="flex-1">
              <SkeletonBlock className={cn('h-4', cellWidths[(row + col) % cellWidths.length])} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** A row of figures, each opening with its gold rule. */
export function StatGroupSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="border-bs-2 border-gold-600 pbs-4">
          <SkeletonBlock className="h-10 w-28" />
          <SkeletonBlock className="mbs-3 h-4 w-3/4" />
          <SkeletonBlock className="mbs-3 h-3 w-1/2" />
        </li>
      ))}
    </ul>
  );
}

/** A form: label + control pairs, then a button. */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-6" aria-hidden="true">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index}>
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="mbs-2 h-11 w-full" />
        </div>
      ))}
      <SkeletonBlock className="h-11 w-40" />
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
 */
export function ListPageSkeleton({ rows = 3, grid }: { rows?: number; grid?: boolean }) {
  return (
    <div className="container-content section-gap" aria-busy="true">
      <PageHeaderSkeleton />
      {grid ? <CardGridSkeleton count={rows} /> : <ListSkeleton rows={rows} />}
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <article className="container-content section-gap" aria-busy="true">
      <PageHeaderSkeleton />
      <SkeletonBlock className="aspect-video w-full" />
      <SkeletonText lines={5} className="measure mbs-10" />
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
      <TableSkeleton rows={rows} />
    </div>
  );
}
