import { PageHeaderSkeleton, SkeletonText } from '@/components/ui/skeleton';

/** The about section — the identity record and its sub-pages are text first. No text: `loading.tsx` cannot read `params`, so it does not know the locale. */
export default function Loading() {
  return (
    <div className="container-content section-gap" aria-busy="true">
      <PageHeaderSkeleton />
      <SkeletonText lines={8} className="measure" />
    </div>
  );
}
