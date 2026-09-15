import { notFound } from 'next/navigation';
import { saveMetricForm } from '@/actions/admin/entity-forms';
import { adminFormDict } from '@/components/admin/admin-dict';
import { ContentForm } from '@/components/admin/content-form';
import { metricFields } from '@/components/admin/field-configs';
import { Flash } from '@/components/admin/flash';
import { DeleteAction } from '@/components/admin/row-actions';
import { AdminHeader } from '@/components/admin/shell';
import { getAdminMetric, listRelationOptions } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { can } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: PageProps<'/admin/metrics/[id]'>) {
  const [{ id }, search, actor] = await Promise.all([params, searchParams, requireAuth()]);

  const [row, programs, projects] = await Promise.all([
    getAdminMetric(actor, id),
    listRelationOptions(actor, 'programs'),
    listRelationOptions(actor, 'projects'),
  ]);
  if (!row) notFound();

  return (
    <>
      <AdminHeader title={row.labelAr} description={`${row.periodStart} → ${row.periodEnd}`} />

      <Flash searchParams={search} />

      <ContentForm
        action={saveMetricForm}
        fields={metricFields({
          programs: programs.map((p) => ({ value: p.id, label: p.label })),
          projects: projects.map((p) => ({ value: p.id, label: p.label })),
        })}
        values={row}
        canPublish={can(actor, 'content.publish')}
        includeSeo={false}
        bar="save"
        dict={adminFormDict()}
      />

      <div className="mbs-8">
        <DeleteAction entity="metric" id={id} actor={actor} returnTo="/admin/metrics" label={row.labelAr} />
      </div>
    </>
  );
}
