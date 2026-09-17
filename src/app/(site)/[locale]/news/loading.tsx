import { ListPageSkeleton } from '@/components/ui/skeleton';

/**
 * The post list: one ruled card per row.
 *
 * No text: `loading.tsx` cannot read `params`, so it does not know the locale.
 */
export default function Loading() {
  return <ListPageSkeleton rows={5} />;
}
