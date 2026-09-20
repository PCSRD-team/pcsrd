import { adminUi } from '@/components/admin/admin-ui-dict';
import { AdminPagination, DateCell } from '@/components/admin/controls';
import { AdminHeader } from '@/components/admin/shell';
import { Bidi } from '@/components/ui/bidi';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/inputs';
import { Cluster } from '@/components/ui/layout';
import { Table } from '@/components/ui/table';
import { listAudit, listAuditEntityTypes } from '@/db/queries/admin';
import { AUDIT_ACTIONS, type AuditAction } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guard';
import { assertCan } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

/**
 * The audit log. Read-only, and enforced as such by the database: the
 * `block_audit_mutation` trigger refuses an UPDATE or DELETE on this table, so
 * "append-only" is a property of the schema rather than a promise made here.
 *
 * The two filters are a plain `<form method="get">` — a shareable URL, a back
 * button that behaves, and no JavaScript. `entityType` was already honoured by
 * the query with nothing in the page able to set it; `action` is the other
 * half of the question this log gets asked ("who published what", "who opened
 * a complaint"), and `audit_action_idx` serves it.
 */
export default async function AuditPage({ searchParams }: PageProps<'/admin/audit'>) {
  const [actor, search] = await Promise.all([requireAuth(), searchParams]);
  assertCan(actor, 'audit.read');

  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const page = Number(one(search.page));
  const entityType = one(search.entityType) || undefined;
  const rawAction = one(search.action);
  const action = (AUDIT_ACTIONS as readonly string[]).includes(rawAction ?? '')
    ? (rawAction as AuditAction)
    : undefined;

  const [result, entityTypes] = await Promise.all([
    listAudit(actor, {
      entityType,
      action,
      page: Number.isInteger(page) && page > 0 ? page : 1,
    }),
    listAuditEntityTypes(actor),
  ]);

  const t = adminUi.audit;
  const list = adminUi.list;
  const actionLabel = (value: string) => (t.actions as Record<string, string>)[value] ?? value;
  const entityLabel = (value: string) => (t.entities as Record<string, string>)[value] ?? value;
  const filtered = Boolean(entityType || action);

  const hrefFor = (n: number) => {
    const query = new URLSearchParams();
    if (entityType) query.set('entityType', entityType);
    if (action) query.set('action', action);
    if (n > 1) query.set('page', String(n));
    const qs = query.toString();
    return qs ? `/admin/audit?${qs}` : '/admin/audit';
  };

  return (
    <>
      <AdminHeader title={t.title} description={t.lede} />

      <form method="get" className="mbe-6">
        <Cluster gap={3} align="end">
          <Field name="entityType" label={t.filterEntity} className="min-w-48">
            <Select
              name="entityType"
              defaultValue={entityType ?? ''}
              placeholder={list.all}
              options={entityTypes.map((value) => ({ value, label: entityLabel(value) }))}
            />
          </Field>
          <Field name="action" label={t.filterAction} className="min-w-40">
            <Select
              name="action"
              defaultValue={action ?? ''}
              placeholder={list.all}
              options={AUDIT_ACTIONS.map((value) => ({ value, label: actionLabel(value) }))}
            />
          </Field>
          <Button type="submit" tone="secondary">
            {list.filter}
          </Button>
          {filtered ? (
            <ButtonLink href="/admin/audit" tone="quiet">
              {list.clearFilter}
            </ButtonLink>
          ) : null}
        </Cluster>
      </form>

      <Table
        caption={t.title}
        captionHidden
        rows={result.items}
        empty={
          <EmptyState
            title={filtered ? t.noResults : t.empty}
            body={filtered ? list.noResultsBody : t.lede}
            action={
              filtered ? (
                <ButtonLink href="/admin/audit" tone="secondary">
                  {list.clearFilter}
                </ButtonLink>
              ) : undefined
            }
          />
        }
        columns={[
          { key: 'action', header: t.columns.action, cell: (r) => actionLabel(r.action) },
          { key: 'entity', header: t.columns.entity, cell: (r) => <Bidi>{entityLabel(r.entityType)}</Bidi> },
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

      <AdminPagination page={result.page} totalPages={result.totalPages} hrefFor={hrefFor} />
    </>
  );
}
