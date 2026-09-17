import { ListPageSkeleton } from '@/components/ui/skeleton';

/**
 * The vacancy table resolves here.
 *
 * No text: `loading.tsx` cannot read `params`, so it does not know the locale.
 */
export default function Loading() {
  return <ListPageSkeleton rows={4} />;
}
