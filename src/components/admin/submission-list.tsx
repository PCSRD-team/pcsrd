import Link from 'next/link';
import { DataTable, Pagination, TimeCell } from '@/components/admin/controls';
import { AdminHeader } from '@/components/admin/shell';
import { listSubmissions } from '@/db/queries/admin';
import type { SubmissionState, SubmissionType } from '@/db/schema/enums';
import type { Actor } from '@/services/_shared/actor';

/**
 * The inbox.
 *
 * The list shows the **reference and the type, never the content**. Opening a
 * submission is a deliberate act, and for a confidential complaint it is an
 * audited one — a list that previewed the first line of every message would
 * make that audit meaningless.
 */

export const TYPE_LABEL: Record<SubmissionType, string> = {
  partnership: 'شراكة',
  contact: 'تواصل',
  volunteer: 'تطوّع',
  job: 'توظيف',
  complaint: 'شكوى',
  fraud_report: 'بلاغ انتحال',
};

export const STATE_LABEL: Record<SubmissionState, string> = {
  new: 'جديد',
  in_progress: 'قيد المعالجة',
  handled: 'مُعالَج',
  archived: 'مؤرشف',
};

export async function SubmissionListPage({
  actor,
  sensitive,
  page,
}: {
  actor: Actor;
  sensitive: boolean;
  page: number;
}) {
  const result = await listSubmissions(actor, { sensitive, page });
  const base = sensitive ? '/admin/submissions/sensitive' : '/admin/submissions';

  return (
    <>
      <AdminHeader
        title={sensitive ? 'الشكاوى السرّية' : 'الطلبات الواردة'}
        description={
          sensitive
            ? 'محتوى هذه الشكاوى مشفّر في قاعدة البيانات، وفتح أي منها يُسجَّل في سجل التدقيق. لا تُنزَّل مرفقاتها.'
            : `${result.total} طلب`
        }
      />

      <DataTable
        rows={result.items}
        rowHref={(row) => `/admin/submissions/${row.id}`}
        empty="لا طلبات."
        columns={[
          { key: 'reference', header: 'المرجع', cell: (row) => row.reference },
          { key: 'type', header: 'النوع', cell: (row) => TYPE_LABEL[row.type] },
          { key: 'state', header: 'الحالة', cell: (row) => STATE_LABEL[row.state] },
          {
            key: 'attachment',
            header: 'مرفق',
            cell: (row) => (row.hasAttachment ? 'نعم' : '—'),
          },
          { key: 'handled', header: 'المسؤول', cell: (row) => row.handledBy ?? '—' },
          {
            key: 'created',
            header: 'وصل',
            numeric: true,
            cell: (row) => <TimeCell value={row.createdAt} />,
          },
          {
            key: 'purge',
            header: 'يُحذف في',
            numeric: true,
            cell: (row) => row.purgeAfter,
          },
        ]}
      />

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        hrefFor={(n) => (n > 1 ? `${base}?page=${n}` : base)}
      />

      {!sensitive ? (
        <p className="mbs-6 text-caption text-ink-55">
          الشكاوى السرّية لا تظهر هنا. <Link href="/admin/submissions/sensitive">عرضها</Link> يتطلّب
          صلاحية مستقلة.
        </p>
      ) : null}
    </>
  );
}
