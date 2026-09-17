import { ListPageSkeleton } from '@/components/ui/skeleton';

/**
 * Logo tiles arrive as a grid.
 *
 * No text: `loading.tsx` cannot read `params`, so it does not know the locale.
 */
export default function Loading() {
  return <ListPageSkeleton rows={6} grid />;
}
