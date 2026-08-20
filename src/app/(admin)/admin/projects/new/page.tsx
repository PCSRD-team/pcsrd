import { AdminHeader } from '@/components/admin/shell';
import { ProjectForm } from '@/components/admin/project-form';
import { listRelationOptions } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { ADMIN_OPTIONS } from '@/lib/admin-options';
import { can } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

export default async function NewProjectPage() {
  const actor = await requireAuth();
  const [programs, partners] = await Promise.all([
    listRelationOptions(actor, 'programs'),
    listRelationOptions(actor, 'partners'),
  ]);

  return (
    <>
      <AdminHeader title="مشروع جديد" />
      <ProjectForm
        values={{}}
        canPublish={can(actor, 'content.publish')}
        canDelete={can(actor, 'content.delete')}
        options={{
          programs: programs.map((p) => ({ value: p.id, label: p.label })),
          partners: partners.map((p) => ({ value: p.id, label: p.label })),
          governorates: [...ADMIN_OPTIONS.governorate],
          themes: [...ADMIN_OPTIONS.theme],
          states: [...ADMIN_OPTIONS.projectState],
        }}
      />
    </>
  );
}
