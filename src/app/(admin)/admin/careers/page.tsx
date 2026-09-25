import { adminDict } from '@/components/admin/admin-dict';
import { adminUi, fill } from '@/components/admin/admin-ui-dict';
import { DateCell, StatusBadge } from '@/components/admin/controls';
import { Flash } from '@/components/admin/flash';
import { AdminHeader } from '@/components/admin/shell';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Cluster } from '@/components/ui/layout';
import { Table, type Column } from '@/components/ui/table';
import { type AdminFormRow, listAdminForms } from '@/db/queries/admin/applications';
import { requireAuth } from '@/lib/auth/guard';
import { isFormOpen } from '@/services/applications/application-form.service';

export const dynamic = 'force-dynamic';

/**
 * The careers portal's index.
 *
 * Deliberately **not** `EntityListPage`. That component is the shared screen
 * for the seven CMS entities, and it is shared because those seven differ only
 * in their columns. A form differs in what a reader needs from the row: not a
 * translation badge and a publish state, but *is it open, how many have
 * applied, and how many are still waiting to be looked at*. Forcing it through
 * the generic list would mean adding three optional slots to a component that
 * currently has none.
 */
export default async function CareersPage({ searchParams }: PageProps<'/admin/careers'>) {
  const [actor, search] = await Promise.all([requireAuth(), searchParams]);
  const rows = await listAdminForms(actor);
  const t = adminUi.careers;

  const columns: Column<AdminFormRow>[] = [
    {
      key: 'title',
      header: t.formTitle,
      rowHeader: true,
      cell: (row) => row.titleAr,
    },
    {
      key: 'kind',
      header: t.kind,
      cell: (row) => <Badge tone="neutral">{t.kinds[row.kind]}</Badge>,
    },
    {
      key: 'status',
      header: adminUi.list.status,
      cell: (row) => (
        <Cluster gap={2}>
          <StatusBadge status={row.status} />
          <OpenBadge row={row} />
        </Cluster>
      ),
    },
    {
      key: 'closesAt',
      header: t.closesAt,
      numeric: true,
      cell: (row) => (row.closesAt ? <DateCell value={row.closesAt} /> : '—'),
    },
    {
      key: 'applicants',
      header: t.applicants,
      numeric: true,
      // The new count is what the recruiter is scanning for, so it is the
      // number that gets the gold mark rather than the total.
      cell: (row) => (
        <Cluster gap={2}>
          <span>{row.applicationCount}</span>
          {row.newCount > 0 ? <Badge tone="accent">{row.newCount}</Badge> : null}
        </Cluster>
      ),
    },
    {
      key: 'capacity',
      header: t.capacity,
      numeric: true,
      cell: (row) =>
        row.capacity === null ? '—' : `${row.submissionCount} / ${row.capacity}`,
    },
  ];

  return (
    <>
      <AdminHeader
        title={t.title}
        description={t.description}
        meta={fill(t.formCount, { n: rows.length })}
        action={<ButtonLink href="/admin/careers/new">{t.newForm}</ButtonLink>}
      />

      <Flash searchParams={search} />

      <Table
        caption={t.title}
        captionHidden
        rows={rows}
        columns={columns}
        rowHref={(row) => `/admin/careers/${row.id}`}
        actionsLabel={adminDict.form.actions}
        actions={(row) => (
          <Cluster gap={2}>
            <ButtonLink href={`/admin/careers/${row.id}`} tone="quiet">
              {t.settings}
            </ButtonLink>
            <ButtonLink href={`/admin/careers/${row.id}/applicants`} tone="quiet">
              {t.applicants}
            </ButtonLink>
          </Cluster>
        )}
        empty={<EmptyState title={t.noForms} body={t.noFormsBody} />}
      />
    </>
  );
}

/**
 * Open / closed, computed the same way `app.submit_application()` decides it.
 *
 * A published form is not necessarily an open one — it may not have started,
 * may have closed, or may be full — and "published" is the only thing
 * `StatusBadge` can say. Showing both is what stops a recruiter wondering why
 * nobody is applying to a form that looks live.
 */
function OpenBadge({ row }: { row: AdminFormRow }) {
  const labels = adminUi.careers.openState;
  const state = isFormOpen(row);

  if (state.open) return <Badge tone="accent">{labels.open}</Badge>;
  // `unpublished` is already said by the status badge beside this one.
  if (!state.reason || state.reason === 'unpublished') return null;

  return <Badge tone="neutral">{labels[state.reason]}</Badge>;
}
