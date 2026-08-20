import { DataTable, Pagination, TimeCell } from '@/components/admin/controls';
import { AdminHeader } from '@/components/admin/shell';
import { listAudit } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { assertCan } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

const ACTION_LABEL: Record<string, string> = {
  create: 'إنشاء',
  update: 'تعديل',
  publish: 'نشر',
  unpublish: 'إلغاء نشر',
  archive: 'أرشفة',
  delete: 'حذف',
  view_sensitive: 'فتح شكوى سرّية',
  download_attachment: 'تنزيل مرفق',
};

/**
 * The audit log. Read-only, and enforced as such by the database: the
 * `block_audit_mutation` trigger refuses an UPDATE or DELETE on this table, so
 * "append-only" is a property of the schema rather than a promise made here.
 */
export default async function AuditPage({ searchParams }: PageProps<'/admin/audit'>) {
  const [actor, search] = await Promise.all([requireAuth(), searchParams]);
  assertCan(actor, 'audit.read');

  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const page = Number(one(search.page));
  const entityType = one(search.entityType) || undefined;

  const result = await listAudit(actor, {
    entityType,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  });

  return (
    <>
      <AdminHeader
        title="سجل التدقيق"
        description="للقراءة فقط. قاعدة البيانات ترفض أي تعديل أو حذف على هذا الجدول."
      />

      <DataTable
        rows={result.items}
        empty="لا سجلات."
        columns={[
          { key: 'action', header: 'الإجراء', cell: (r) => ACTION_LABEL[r.action] ?? r.action },
          { key: 'entity', header: 'العنصر', cell: (r) => r.entityType },
          {
            key: 'fields',
            header: 'الحقول المتغيّرة',
            cell: (r) => (r.diff ? Object.keys(r.diff).join('، ') : '—'),
          },
          { key: 'actor', header: 'المستخدم', cell: (r) => (r.isSystem ? 'النظام' : r.actorName) },
          {
            key: 'at',
            header: 'التاريخ',
            numeric: true,
            cell: (r) => <TimeCell value={r.createdAt} />,
          },
        ]}
      />

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        hrefFor={(n) => (n > 1 ? `/admin/audit?page=${n}` : '/admin/audit')}
      />
    </>
  );
}
