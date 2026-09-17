import { notFound } from 'next/navigation';
import { savePostForm } from '@/actions/admin/entity-forms';
import { adminFormDict } from '@/components/admin/admin-dict';
import { adminUi } from '@/components/admin/admin-ui-dict';
import { ContentForm } from '@/components/admin/content-form';
import { StatusBadge } from '@/components/admin/controls';
import { postFields } from '@/components/admin/field-configs';
import { Flash } from '@/components/admin/flash';
import { DeletePanel } from '@/components/admin/row-actions';
import { AdminHeader } from '@/components/admin/shell';
import { getAdminGallery, getAdminRow, listRelationOptions } from '@/db/queries/admin';
import type { ContentStatus } from '@/db/schema/enums';
import { requireAuth } from '@/lib/auth/guard';
import { can } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: PageProps<'/admin/posts/[id]'>) {
  const [{ id }, search, actor] = await Promise.all([params, searchParams, requireAuth()]);

  const [row, gallery] = await Promise.all([
    getAdminRow(actor, 'post', id),
    getAdminGallery(actor, 'post', id),
  ]);
  if (!row) notFound();
  const [programs, projects] = await Promise.all([
    listRelationOptions(actor, 'programs'),
    listRelationOptions(actor, 'projects'),
  ]);
  const options = {
    programs: programs.map((p) => ({ value: p.id, label: p.label })),
    projects: projects.map((p) => ({ value: p.id, label: p.label })),
  };

  // The gallery is a junction, not a column; it rides along as `gallery` so
  // the form can post it back in order.
  const values: Record<string, unknown> = { ...(row as Record<string, unknown>), gallery };
  const title = String(values.titleAr ?? adminUi.entity.fallbackPost);
  const status = values.status as ContentStatus;

  return (
    <>
      <AdminHeader title={title} meta={<StatusBadge status={status} />} />

      <Flash searchParams={search} />

      <ContentForm
        action={savePostForm}
        fields={postFields(options)}
        values={values}
        canPublish={can(actor, 'content.publish')}
        includeSeo={true}
        dict={adminFormDict()}
      />

      <DeletePanel entity="post" id={id} status={status} actor={actor} returnTo="/admin/posts" label={title} />
    </>
  );
}
