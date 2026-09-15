import { notFound } from 'next/navigation';
import { savePageForm } from '@/actions/admin/entity-forms';
import { adminFormDict } from '@/components/admin/admin-dict';
import { ContentForm } from '@/components/admin/content-form';
import { PAGE_FIELDS } from '@/components/admin/field-configs';
import { Flash } from '@/components/admin/flash';
import { DeleteAction } from '@/components/admin/row-actions';
import { AdminHeader } from '@/components/admin/shell';
import { getAdminRow } from '@/db/queries/admin';
import type { ContentStatus } from '@/db/schema/enums';
import { requireAuth } from '@/lib/auth/guard';
import { can } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: PageProps<'/admin/pages/[id]'>) {
  const [{ id }, search, actor] = await Promise.all([params, searchParams, requireAuth()]);

  const row = await getAdminRow(actor, 'page', id);
  if (!row) notFound();
  const values = row as Record<string, unknown>;
  const title = String(values.titleAr ?? 'صفحة');

  return (
    <>
      <AdminHeader title={title} />

      <Flash searchParams={search} />

      <ContentForm
        action={savePageForm}
        fields={PAGE_FIELDS}
        values={values}
        canPublish={can(actor, 'content.publish')}
        includeSeo={true}
        dict={adminFormDict()}
      />

      {/* Its own form, outside the editor: a form cannot nest in a form. */}
      <div className="mbs-8">
        <DeleteAction
          entity="page"
          id={id}
          status={values.status as ContentStatus}
          actor={actor}
          returnTo="/admin/pages"
          label={title}
        />
      </div>
    </>
  );
}
