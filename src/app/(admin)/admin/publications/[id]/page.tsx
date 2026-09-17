import { notFound } from 'next/navigation';
import { savePublicationForm } from '@/actions/admin/entity-forms';
import { adminFormDict } from '@/components/admin/admin-dict';
import { adminUi } from '@/components/admin/admin-ui-dict';
import { ContentForm } from '@/components/admin/content-form';
import { StatusBadge } from '@/components/admin/controls';
import { PUBLICATION_FIELDS } from '@/components/admin/field-configs';
import { Flash } from '@/components/admin/flash';
import { DeletePanel } from '@/components/admin/row-actions';
import { AdminHeader } from '@/components/admin/shell';
import { getAdminRow } from '@/db/queries/admin';
import type { ContentStatus } from '@/db/schema/enums';
import { requireAuth } from '@/lib/auth/guard';
import { can } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: PageProps<'/admin/publications/[id]'>) {
  const [{ id }, search, actor] = await Promise.all([params, searchParams, requireAuth()]);

  const row = await getAdminRow(actor, 'publication', id);
  if (!row) notFound();
  const values = row as Record<string, unknown>;
  const title = String(values.titleAr ?? adminUi.entity.fallbackPublication);
  const status = values.status as ContentStatus;

  return (
    <>
      <AdminHeader title={title} meta={<StatusBadge status={status} />} />

      <Flash searchParams={search} />

      <ContentForm
        action={savePublicationForm}
        fields={PUBLICATION_FIELDS}
        values={values}
        canPublish={can(actor, 'content.publish')}
        includeSeo={false}
        dict={adminFormDict()}
      />

      <DeletePanel
        entity="publication"
        id={id}
        status={status}
        actor={actor}
        returnTo="/admin/publications"
        label={title}
      />
    </>
  );
}
