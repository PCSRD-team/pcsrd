import { notFound } from 'next/navigation';
import { savePersonForm } from '@/actions/admin/entity-forms';
import { adminFormDict } from '@/components/admin/admin-dict';
import { ContentForm } from '@/components/admin/content-form';
import { PERSON_FIELDS } from '@/components/admin/field-configs';
import { Flash } from '@/components/admin/flash';
import { DeletePanel } from '@/components/admin/row-actions';
import { AdminHeader } from '@/components/admin/shell';
import { getAdminPerson } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { can } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: PageProps<'/admin/people/[id]'>) {
  const [{ id }, search, actor] = await Promise.all([params, searchParams, requireAuth()]);

  const row = await getAdminPerson(actor, id);
  if (!row) notFound();

  return (
    <>
      <AdminHeader title={row.nameAr} description={row.roleAr} />

      <Flash searchParams={search} />

      <ContentForm
        action={savePersonForm}
        fields={PERSON_FIELDS}
        values={row}
        canPublish={can(actor, 'content.publish')}
        includeSeo={false}
        bar="save"
        dict={adminFormDict()}
      />

      <DeletePanel entity="person" id={id} actor={actor} returnTo="/admin/people" label={row.nameAr} />
    </>
  );
}
