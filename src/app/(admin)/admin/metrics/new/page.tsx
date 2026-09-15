import { saveMetricForm } from '@/actions/admin/entity-forms';
import { adminFormDict } from '@/components/admin/admin-dict';
import { ContentForm } from '@/components/admin/content-form';
import { metricFields } from '@/components/admin/field-configs';
import { AdminHeader } from '@/components/admin/shell';
import { listRelationOptions } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { can } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const actor = await requireAuth();
  const [programs, projects] = await Promise.all([
    listRelationOptions(actor, 'programs'),
    listRelationOptions(actor, 'projects'),
  ]);

  return (
    <>
      <AdminHeader title="مؤشر جديد" />
      <ContentForm
        action={saveMetricForm}
        fields={metricFields({
          programs: programs.map((p) => ({ value: p.id, label: p.label })),
          projects: projects.map((p) => ({ value: p.id, label: p.label })),
        })}
        values={{}}
        canPublish={can(actor, 'content.publish')}
        includeSeo={false}
        bar="save"
        dict={adminFormDict()}
      />
    </>
  );
}
