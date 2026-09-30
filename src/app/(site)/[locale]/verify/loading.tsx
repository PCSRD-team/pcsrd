import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/skeleton';

/**
 * The official-channels register is a table.
 *
 * No text: `loading.tsx` cannot read `params`, so it does not know the locale.
 */
export default function Loading() {
  return (
    <div className="container-content section-gap" aria-busy="true">
      <PageHeaderSkeleton />
      <TableSkeleton rows={4} columns={3} />
    </div>
  );
}
