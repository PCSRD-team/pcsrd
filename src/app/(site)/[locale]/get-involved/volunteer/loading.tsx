import { FormSkeleton, PageHeaderSkeleton } from '@/components/ui/skeleton';

/** The volunteer form. No text: `loading.tsx` cannot read `params`, so it does not know the locale. */
export default function Loading() {
  return (
    <div className="container-content section-gap" aria-busy="true">
      <PageHeaderSkeleton />
      <div className="max-w-prose">
        <FormSkeleton fields={6} />
      </div>
    </div>
  );
}
