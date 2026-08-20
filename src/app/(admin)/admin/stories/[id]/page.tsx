import { notFound } from 'next/navigation';
import { saveStoryForm } from '@/actions/admin/entity-forms';
import { ContentForm } from '@/components/admin/content-form';
import { STORY_FIELDS } from '@/components/admin/field-configs';
import { AdminHeader } from '@/components/admin/shell';
import { getAdminRow } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { can } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: PageProps<'/admin/stories/[id]'>) {
  const [{ id }, search, actor] = await Promise.all([params, searchParams, requireAuth()]);

  const row = await getAdminRow(actor, 'story', id);
  if (!row) notFound();

  return (
    <>
      <AdminHeader title={String((row as Record<string, unknown>).titleAr ?? 'قصة')} />

      {search.saved ? (
        <div className="rule-edge mbe-6 border-gold-600 bg-gold-050 p-4" role="status">
          <p className="text-small text-ink">تم الحفظ.</p>
        </div>
      ) : null}

      <ContentForm
        action={saveStoryForm}
        fields={STORY_FIELDS}
        values={row as Record<string, unknown>}
        canPublish={can(actor, 'content.publish')}
        canDelete={can(actor, 'content.delete')}
        includeSeo={true}
      />
    </>
  );
}
