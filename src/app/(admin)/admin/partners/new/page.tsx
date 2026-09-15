import { savePartnerForm } from '@/actions/admin/entity-forms';
import { adminFormDict } from '@/components/admin/admin-dict';
import { ContentForm } from '@/components/admin/content-form';
import { PARTNER_FIELDS } from '@/components/admin/field-configs';
import { AdminHeader } from '@/components/admin/shell';
import { requireAuth } from '@/lib/auth/guard';
import { can } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const actor = await requireAuth();

  return (
    <>
      <AdminHeader title="شريك جديد" />
      <ContentForm
        action={savePartnerForm}
        fields={PARTNER_FIELDS}
        values={{}}
        canPublish={can(actor, 'content.publish')}
        includeSeo={false}
        translation={false}
        dict={adminFormDict()}
      />
    </>
  );
}
