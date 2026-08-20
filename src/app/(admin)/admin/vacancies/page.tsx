import { EntityListPage } from '@/components/admin/entity-list';
import { requireAuth } from '@/lib/auth/guard';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: PageProps<'/admin/vacancies'>) {
  const [actor, search] = await Promise.all([requireAuth(), searchParams]);
  return <EntityListPage actor={actor} entity="vacancy" searchParams={search} />;
}
