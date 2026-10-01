import { CardGridSkeleton, PageHeaderSkeleton, StatGroupSkeleton } from '@/components/ui/skeleton';

/**
 * The home page: a header, the verified figures, then the programme cards —
 * the order the page resolves in.
 *
 * Also the fallback for any `[locale]` route without a `loading.tsx` of its
 * own; every section below has one, so in practice this is the home page's.
 * No text: `loading.tsx` cannot read `params`, so it does not know the locale.
 */
export default function Loading() {
  return (
    <div className="container-content section-gap" aria-busy="true">
      <PageHeaderSkeleton />
      <StatGroupSkeleton count={3} />
      <div className="mbs-12">
        <CardGridSkeleton count={3} />
      </div>
    </div>
  );
}
