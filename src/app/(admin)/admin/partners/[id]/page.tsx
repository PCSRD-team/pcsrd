import { notFound } from 'next/navigation';
import { savePartnerForm } from '@/actions/admin/entity-forms';
import { adminFormDict } from '@/components/admin/admin-dict';
import { ContentForm } from '@/components/admin/content-form';
import { PARTNER_FIELDS } from '@/components/admin/field-configs';
import { Flash } from '@/components/admin/flash';
import { DeleteAction } from '@/components/admin/row-actions';
import { AdminHeader } from '@/components/admin/shell';
import { getAdminPartner } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { can } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: PageProps<'/admin/partners/[id]'>) {
  const [{ id }, search, actor] = await Promise.all([params, searchParams, requireAuth()]);

  const row = await getAdminPartner(actor, id);
  if (!row) notFound();

  return (
    <>
      <AdminHeader title={row.nameAr} />

      <Flash searchParams={search} />

      <ContentForm
        action={savePartnerForm}
        fields={PARTNER_FIELDS}
        values={row}
        canPublish={can(actor, 'content.publish')}
        includeSeo={false}
        translation={false}
        dict={adminFormDict()}
      />

      <div className="mbs-8">
        <DeleteAction
          entity="partner"
          id={id}
          status={row.status}
          actor={actor}
          returnTo="/admin/partners"
          label={row.nameAr}
        />
      </div>
    </>
  );
}
