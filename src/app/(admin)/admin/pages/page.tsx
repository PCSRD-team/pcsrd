import { EntityListPage } from '@/components/admin/entity-list';
import { requireAuth } from '@/lib/auth/guard';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: PageProps<'/admin/pages'>) {
  const [actor, search] = await Promise.all([requireAuth(), searchParams]);
  return <EntityListPage actor={actor} entity="page" searchParams={search} />;
}
