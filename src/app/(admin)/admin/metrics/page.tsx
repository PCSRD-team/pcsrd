import Link from 'next/link';
import { adminDict } from '@/components/admin/admin-dict';
import { DataTable } from '@/components/admin/controls';
import { Flash } from '@/components/admin/flash';
import { RowActions } from '@/components/admin/row-actions';
import { AdminHeader } from '@/components/admin/shell';
import { listAdminMetrics } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { ADMIN_OPTIONS } from '@/lib/admin-options';

export const dynamic = 'force-dynamic';

const statusLabel = Object.fromEntries(
  ADMIN_OPTIONS.metricStatus.map((o) => [o.value, o.label]),
) as Record<string, string>;

/**
 * Impact figures.
 *
 * The period and the verification status are columns in the list, not details
 * behind a click: a figure without both cannot be published, and the constraint
 * `metrics_verified_needs_source` refuses it in the database as well.
 */
export default async function MetricsAdminPage({ searchParams }: PageProps<'/admin/metrics'>) {
  const [actor, search] = await Promise.all([requireAuth(), searchParams]);
  const rows = await listAdminMetrics(actor);

  return (
    <>
      <AdminHeader
        title="مؤشرات الأثر"
        description="لا يُنشر رقم إلا مقترناً بفترته وحالة التحقّق منه ومصدرها."
        action={
          <Link
            href="/admin/metrics/new"
            className="bg-navy-700 px-5 py-2 text-small font-medium text-paper no-underline hover:bg-navy-900"
          >
            {adminDict.form.add}
          </Link>
        }
      />

      <Flash searchParams={search} />

      <DataTable
        rows={rows}
        rowHref={(r) => `/admin/metrics/${r.id}`}
        empty="لا مؤشرات."
        columns={[
          { key: 'label', header: 'المؤشر', cell: (r) => r.labelAr },
          { key: 'value', header: 'القيمة', numeric: true, cell: (r) => `${r.displayPrefix ?? ''}${r.value} ${r.unit}` },
          { key: 'period', header: 'الفترة', numeric: true, cell: (r) => `${r.periodStart} → ${r.periodEnd}` },
          { key: 'status', header: 'التحقّق', cell: (r) => statusLabel[r.status] ?? r.status },
          { key: 'source', header: 'المصدر', cell: (r) => r.verificationSource ?? '—' },
          { key: 'public', header: 'منشور', cell: (r) => (r.isPublic ? 'نعم' : 'لا') },
          {
            key: 'actions',
            header: adminDict.form.actions,
            cell: (r) => (
              <RowActions
                entity="metric"
                id={r.id}
                actor={actor}
                returnTo="/admin/metrics"
                label={r.labelAr}
              />
            ),
          },
        ]}
      />
    </>
  );
}
