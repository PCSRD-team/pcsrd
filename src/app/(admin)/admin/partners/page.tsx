import { adminDict } from '@/components/admin/admin-dict';
import { adminUi } from '@/components/admin/admin-ui-dict';
import { StatusBadge } from '@/components/admin/controls';
import { Flash } from '@/components/admin/flash';
import { RowActions } from '@/components/admin/row-actions';
import { AdminHeader } from '@/components/admin/shell';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Table } from '@/components/ui/table';
import { listAdminPartners } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { ADMIN_OPTIONS } from '@/lib/admin-options';

export const dynamic = 'force-dynamic';

const typeLabel = Object.fromEntries(
  ADMIN_OPTIONS.partnerType.map((o) => [o.value, o.label]),
) as Record<string, string>;
const permissionLabel = Object.fromEntries(
  ADMIN_OPTIONS.logoPermission.map((o) => [o.value, o.label]),
) as Record<string, string>;

export default async function PartnersAdminPage({ searchParams }: PageProps<'/admin/partners'>) {
  const [actor, search] = await Promise.all([requireAuth(), searchParams]);
  const rows = await listAdminPartners(actor);
  const t = adminUi.partners;
  const title = adminUi.nav.partners;

  return (
    <>
      <AdminHeader
        title={title}
        description={t.lede}
        action={<ButtonLink href="/admin/partners/new">{adminDict.form.add}</ButtonLink>}
      />

      <Flash searchParams={search} />

      <Table
        caption={title}
        captionHidden
        rows={rows}
        rowHref={(r) => `/admin/partners/${r.id}`}
        empty={
          <EmptyState
            title={t.empty}
            body={t.emptyBody}
            action={<ButtonLink href="/admin/partners/new">{adminDict.form.add}</ButtonLink>}
          />
        }
        columns={[
          { key: 'name', header: adminUi.list.columns.name, rowHeader: true, cell: (r) => r.nameAr },
          { key: 'type', header: t.columns.type, cell: (r) => typeLabel[r.type] ?? r.type },
          {
            key: 'logo',
            header: t.columns.logo,
            cell: (r) => permissionLabel[r.logoPermission] ?? r.logoPermission,
          },
          { key: 'status', header: adminUi.list.columns.status, cell: (r) => <StatusBadge status={r.status} /> },
          { key: 'order', header: adminUi.list.columns.order, numeric: true, cell: (r) => r.displayOrder },
          {
            key: 'actions',
            header: adminDict.form.actions,
            cell: (r) => (
              <RowActions
                entity="partner"
                id={r.id}
                status={r.status}
                actor={actor}
                returnTo="/admin/partners"
                label={r.nameAr}
              />
            ),
          },
        ]}
      />
    </>
  );
}
