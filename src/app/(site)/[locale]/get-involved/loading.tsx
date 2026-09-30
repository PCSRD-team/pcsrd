import { ListPageSkeleton } from '@/components/ui/skeleton';

/**
 * The three ways to get involved, as cards. The partner, volunteer and
 * support forms each have their own `loading.tsx`.
 *
 * No text: `loading.tsx` cannot read `params`, so it does not know the locale.
 */
export default function Loading() {
  return <ListPageSkeleton rows={3} grid />;
}
