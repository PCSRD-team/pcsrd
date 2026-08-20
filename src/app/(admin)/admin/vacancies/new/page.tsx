import { saveVacancyForm } from '@/actions/admin/entity-forms';
import { ContentForm } from '@/components/admin/content-form';
import { VACANCY_FIELDS } from '@/components/admin/field-configs';
import { AdminHeader } from '@/components/admin/shell';
import { requireAuth } from '@/lib/auth/guard';
import { can } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const actor = await requireAuth();

  return (
    <>
      <AdminHeader title="وظيفة جديدة" />
      <ContentForm
        action={saveVacancyForm}
        fields={VACANCY_FIELDS}
        values={{}}
        canPublish={can(actor, 'content.publish')}
        canDelete={can(actor, 'content.delete')}
        includeSeo={true}
      />
    </>
  );
}
