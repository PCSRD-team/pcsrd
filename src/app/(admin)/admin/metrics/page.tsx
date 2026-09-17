import { adminDict } from '@/components/admin/admin-dict';
import { adminUi } from '@/components/admin/admin-ui-dict';
import { Flash } from '@/components/admin/flash';
import { RowActions } from '@/components/admin/row-actions';
import { AdminHeader } from '@/components/admin/shell';
import { VerificationBadge } from '@/components/ui/badge';
import { Bidi } from '@/components/ui/bidi';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Table } from '@/components/ui/table';
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
  const t = adminUi.metrics;
  const title = adminUi.nav.metrics;
  const yesNo = adminUi.list.columns;

  return (
    <>
      <AdminHeader
        title={title}
        description={t.lede}
        action={<ButtonLink href="/admin/metrics/new">{adminDict.form.add}</ButtonLink>}
      />

      <Flash searchParams={search} />

      <Table
        caption={title}
        captionHidden
        rows={rows}
        rowHref={(r) => `/admin/metrics/${r.id}`}
        empty={
          <EmptyState
            title={t.empty}
            body={t.emptyBody}
            action={<ButtonLink href="/admin/metrics/new">{adminDict.form.add}</ButtonLink>}
          />
        }
        columns={[
          { key: 'label', header: t.columns.label, rowHeader: true, cell: (r) => r.labelAr },
          {
            key: 'value',
            header: t.columns.value,
            numeric: true,
            align: 'start',
            cell: (r) => `${r.displayPrefix ?? ''}${r.value} ${r.unit}`,
          },
          {
            key: 'period',
            header: t.columns.period,
            numeric: true,
            align: 'start',
            cell: (r) => <Bidi>{`${r.periodStart} → ${r.periodEnd}`}</Bidi>,
          },
          {
            key: 'status',
            header: t.columns.status,
            cell: (r) => <VerificationBadge status={r.status} label={statusLabel[r.status] ?? r.status} />,
          },
          { key: 'source', header: t.columns.source, cell: (r) => r.verificationSource ?? '—' },
          { key: 'public', header: t.columns.isPublic, cell: (r) => (r.isPublic ? yesNo.yes : yesNo.no) },
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
