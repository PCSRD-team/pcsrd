import { ListPageSkeleton } from '@/components/ui/skeleton';

/**
 * The project list and its facets; a card grid, because that is what arrives.
 *
 * No text: `loading.tsx` cannot read `params`, so it does not know the locale.
 */
export default function Loading() {
  return <ListPageSkeleton rows={4} grid />;
}
