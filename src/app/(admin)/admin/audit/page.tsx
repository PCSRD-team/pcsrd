import { adminUi } from '@/components/admin/admin-ui-dict';
import { AdminPagination, DateCell } from '@/components/admin/controls';
import { AdminHeader } from '@/components/admin/shell';
import { Bidi } from '@/components/ui/bidi';
import { EmptyState } from '@/components/ui/feedback';
import { Table } from '@/components/ui/table';
import { listAudit } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { assertCan } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

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

  const t = adminUi.audit;
  const actionLabel = (action: string) => (t.actions as Record<string, string>)[action] ?? action;

  return (
    <>
      <AdminHeader title={t.title} description={t.lede} />

      <Table
        caption={t.title}
        captionHidden
        rows={result.items}
        empty={<EmptyState title={t.empty} body={t.lede} />}
        columns={[
          { key: 'action', header: t.columns.action, cell: (r) => actionLabel(r.action) },
          { key: 'entity', header: t.columns.entity, cell: (r) => <Bidi>{r.entityType}</Bidi> },
          {
            key: 'fields',
            header: t.columns.fields,
            cell: (r) => (r.diff ? <Bidi>{Object.keys(r.diff).join(', ')}</Bidi> : '—'),
          },
          { key: 'actor', header: t.columns.actor, cell: (r) => (r.isSystem ? t.system : r.actorName) },
          {
            key: 'at',
            header: t.columns.at,
            numeric: true,
            align: 'start',
            cell: (r) => <DateCell value={r.createdAt} />,
          },
        ]}
      />

      <AdminPagination
        page={result.page}
        totalPages={result.totalPages}
        hrefFor={(n) => (n > 1 ? `/admin/audit?page=${n}` : '/admin/audit')}
      />
    </>
  );
}
