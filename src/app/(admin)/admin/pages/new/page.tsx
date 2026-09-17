import { savePageForm } from '@/actions/admin/entity-forms';
import { adminFormDict } from '@/components/admin/admin-dict';
import { adminUi } from '@/components/admin/admin-ui-dict';
import { ContentForm } from '@/components/admin/content-form';
import { PAGE_FIELDS } from '@/components/admin/field-configs';
import { AdminHeader } from '@/components/admin/shell';
import { requireAuth } from '@/lib/auth/guard';
import { can } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const actor = await requireAuth();

  return (
    <>
      <AdminHeader title={adminUi.entity.newPage} />
      <ContentForm
        action={savePageForm}
        fields={PAGE_FIELDS}
        values={{}}
        canPublish={can(actor, 'content.publish')}
        includeSeo={true}
        dict={adminFormDict()}
      />
    </>
  );
}
