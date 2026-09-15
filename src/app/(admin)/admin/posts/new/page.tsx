import { savePostForm } from '@/actions/admin/entity-forms';
import { adminFormDict } from '@/components/admin/admin-dict';
import { ContentForm } from '@/components/admin/content-form';
import { postFields } from '@/components/admin/field-configs';
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
  const options = {
    programs: programs.map((p) => ({ value: p.id, label: p.label })),
    projects: projects.map((p) => ({ value: p.id, label: p.label })),
  };

  return (
    <>
      <AdminHeader title="خبر جديد" />
      <ContentForm
        action={savePostForm}
        fields={postFields(options)}
        values={{}}
        canPublish={can(actor, 'content.publish')}
        includeSeo={true}
        dict={adminFormDict()}
      />
    </>
  );
}
