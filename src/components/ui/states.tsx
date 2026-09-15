/**
 * Compatibility path.
 *
 * The four designed states and the skeletons moved to `feedback.tsx` and
 * `skeleton.tsx`; this module keeps the original import path working. New
 * code imports from `@/components/ui`. Nothing is defined here.
 */
export { EmptyState, ErrorState, UntranslatedNotice, SubmissionReceipt } from './feedback';
export {
  SkeletonBlock,
  SkeletonText,
  ListSkeleton,
  CardGridSkeleton,
  TableSkeleton,
  StatGroupSkeleton,
  FormSkeleton,
  PageHeaderSkeleton,
  ListPageSkeleton,
  DetailPageSkeleton,
  AdminPageSkeleton,
} from './skeleton';
