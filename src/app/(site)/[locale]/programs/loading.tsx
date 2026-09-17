import { ListPageSkeleton } from '@/components/ui/skeleton';

/**
 * The programme index: three ruled rows resolve here.
 *
 * No text: `loading.tsx` cannot read `params`, so it does not know the locale.
 */
export default function Loading() {
  return <ListPageSkeleton rows={3} />;
}
