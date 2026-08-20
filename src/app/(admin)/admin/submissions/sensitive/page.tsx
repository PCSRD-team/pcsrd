import { SubmissionListPage } from '@/components/admin/submission-list';
import { requireSensitiveAccess } from '@/lib/auth/guard';

export const dynamic = 'force-dynamic';

/**
 * Confidential complaints.
 *
 * `requireSensitiveAccess` redirects rather than 403s, and it is checked here
 * *and* in every action and query that touches a sensitive row. Access to this
 * list is granted per person by the organisation's policy — being an admin does
 * not imply it.
 */
export default async function Page({ searchParams }: PageProps<'/admin/submissions/sensitive'>) {
  const [actor, search] = await Promise.all([requireSensitiveAccess(), searchParams]);
  const page = Number(Array.isArray(search.page) ? search.page[0] : search.page);

  return (
    <SubmissionListPage
      actor={actor}
      sensitive
      page={Number.isInteger(page) && page > 0 ? page : 1}
    />
  );
}
