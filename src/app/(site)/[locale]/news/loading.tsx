import { ListPageSkeleton } from '@/components/ui/states';

/**
 * Shown while the newsroom resolves.
 *
 * See `ListPageSkeleton` for why this exists and why the heading is a skeleton
 * rather than real copy.
 */
export default function Loading() {
  return <ListPageSkeleton rows={4} />;
}
