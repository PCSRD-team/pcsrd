import { CardGridSkeleton, FormSkeleton, PageHeaderSkeleton } from '@/components/ui/skeleton';

/** The donate page: the accounts, then the notice form. No text: `loading.tsx` cannot read `params`, so it does not know the locale. */
export default function Loading() {
  return (
    <div className="container-content section-gap" aria-busy="true">
      <PageHeaderSkeleton />
      <CardGridSkeleton count={2} media={false} />
      <div className="mbs-12 max-w-prose">
        <FormSkeleton fields={6} />
      </div>
    </div>
  );
}
