import { SubmissionListPage } from '@/components/admin/submission-list';
import { requireAuth } from '@/lib/auth/guard';
import { assertCan } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: PageProps<'/admin/submissions'>) {
  const [actor, search] = await Promise.all([requireAuth(), searchParams]);
  assertCan(actor, 'submissions.read');

  const page = Number(Array.isArray(search.page) ? search.page[0] : search.page);
  return (
    <SubmissionListPage
      actor={actor}
      sensitive={false}
      page={Number.isInteger(page) && page > 0 ? page : 1}
    />
  );
}
