import { notFound } from 'next/navigation';
import { saveProgramForm } from '@/actions/admin/entity-forms';
import { adminFormDict } from '@/components/admin/admin-dict';
import { adminUi } from '@/components/admin/admin-ui-dict';
import { ContentForm } from '@/components/admin/content-form';
import { StatusBadge } from '@/components/admin/controls';
import { PROGRAM_FIELDS } from '@/components/admin/field-configs';
import { Flash } from '@/components/admin/flash';
import { AdminHeader } from '@/components/admin/shell';
import { getAdminGallery, getAdminRow } from '@/db/queries/admin';
import type { ContentStatus } from '@/db/schema/enums';
import { requireAuth } from '@/lib/auth/guard';
import { can } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: PageProps<'/admin/programs/[id]'>) {
  const [{ id }, search, actor] = await Promise.all([params, searchParams, requireAuth()]);

  const [row, gallery] = await Promise.all([
    getAdminRow(actor, 'program', id),
    getAdminGallery(actor, 'program', id),
  ]);
  if (!row) notFound();

  // The gallery is a junction, not a column; it rides along as `gallery` so
  // the form can post it back in order.
  const values: Record<string, unknown> = { ...(row as Record<string, unknown>), gallery };
  const title = String(values.titleAr ?? adminUi.entity.fallbackProgram);

  return (
    <>
      <AdminHeader title={title} meta={<StatusBadge status={values.status as ContentStatus} />} />

      <Flash searchParams={search} />

      <ContentForm
        action={saveProgramForm}
        fields={PROGRAM_FIELDS}
        values={values}
        canPublish={can(actor, 'content.publish')}
        includeSeo={true}
        dict={adminFormDict()}
      />

      {/* No delete and no `new` page: the three programmes are a fixed set
          seeded by `key` (the enum has exactly three values and every project
          points at one). They are edited and published here, never created
          or removed from the CMS. */}
    </>
  );
}
