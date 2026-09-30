import { PageHeaderSkeleton, SkeletonText } from '@/components/ui/skeleton';

/** A policy page: a heading and its text. No text: `loading.tsx` cannot read `params`, so it does not know the locale. */
export default function Loading() {
  return (
    <div className="container-content section-gap" aria-busy="true">
      <PageHeaderSkeleton />
      <SkeletonText lines={10} className="measure" />
    </div>
  );
}
