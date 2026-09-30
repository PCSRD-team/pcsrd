import { FormSkeleton, PageHeaderSkeleton } from '@/components/ui/skeleton';

/** The partnership enquiry form. No text: `loading.tsx` cannot read `params`, so it does not know the locale. */
export default function Loading() {
  return (
    <div className="container-content section-gap" aria-busy="true">
      <PageHeaderSkeleton />
      <div className="max-w-prose">
        <FormSkeleton fields={5} />
      </div>
    </div>
  );
}
