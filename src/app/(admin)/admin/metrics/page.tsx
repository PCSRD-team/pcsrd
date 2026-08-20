import { DataTable } from '@/components/admin/controls';
import { AdminHeader } from '@/components/admin/shell';
import { listAdminMetrics } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  target: 'مستهدف',
  reported: 'مُبلَّغ عنه',
  verified: 'مُتحقَّق منه',
};

/**
 * Impact figures.
 *
 * The period and the verification status are columns in the list, not details
 * behind a click: a figure without both cannot be published, and the constraint
 * `metrics_verified_needs_source` refuses it in the database as well.
 */
export default async function MetricsAdminPage() {
  const actor = await requireAuth();
  const rows = await listAdminMetrics(actor);

  return (
    <>
      <AdminHeader
        title="مؤشرات الأثر"
        description="لا يُنشر رقم إلا مقترناً بفترته وحالة التحقّق منه ومصدرها."
      />

      <DataTable
        rows={rows}
        empty="لا مؤشرات."
        columns={[
          { key: 'label', header: 'المؤشر', cell: (r) => r.labelAr },
          { key: 'value', header: 'القيمة', numeric: true, cell: (r) => `${r.displayPrefix ?? ''}${r.value} ${r.unit}` },
          { key: 'period', header: 'الفترة', numeric: true, cell: (r) => `${r.periodStart} → ${r.periodEnd}` },
          { key: 'status', header: 'التحقّق', cell: (r) => STATUS_LABEL[r.status] ?? r.status },
          { key: 'source', header: 'المصدر', cell: (r) => r.verificationSource ?? '—' },
          { key: 'public', header: 'منشور', cell: (r) => (r.isPublic ? 'نعم' : 'لا') },
        ]}
      />
    </>
  );
}
