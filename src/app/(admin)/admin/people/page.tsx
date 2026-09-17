import { adminDict } from '@/components/admin/admin-dict';
import { adminUi } from '@/components/admin/admin-ui-dict';
import { Flash } from '@/components/admin/flash';
import { RowActions } from '@/components/admin/row-actions';
import { AdminHeader } from '@/components/admin/shell';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Table } from '@/components/ui/table';
import { listAdminPeople } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { ADMIN_OPTIONS } from '@/lib/admin-options';

export const dynamic = 'force-dynamic';

const categoryLabel = Object.fromEntries(
  ADMIN_OPTIONS.personCategory.map((o) => [o.value, o.label]),
) as Record<string, string>;

export default async function PeopleAdminPage({ searchParams }: PageProps<'/admin/people'>) {
  const [actor, search] = await Promise.all([requireAuth(), searchParams]);
  const rows = await listAdminPeople(actor);
  const t = adminUi.people;
  const title = adminUi.nav.people;
  const yesNo = adminUi.list.columns;

  return (
    <>
      <AdminHeader
        title={title}
        description={t.lede}
        action={<ButtonLink href="/admin/people/new">{adminDict.form.add}</ButtonLink>}
      />

      <Flash searchParams={search} />

      <Table
        caption={title}
        captionHidden
        rows={rows}
        rowHref={(r) => `/admin/people/${r.id}`}
        empty={
          <EmptyState
            title={t.empty}
            body={t.emptyBody}
            action={<ButtonLink href="/admin/people/new">{adminDict.form.add}</ButtonLink>}
          />
        }
        columns={[
          { key: 'name', header: yesNo.name, rowHeader: true, cell: (r) => r.nameAr },
          { key: 'role', header: t.columns.role, cell: (r) => r.roleAr },
          { key: 'category', header: t.columns.category, cell: (r) => categoryLabel[r.category] ?? r.category },
          { key: 'public', header: t.columns.isPublic, cell: (r) => (r.isPublic ? yesNo.yes : yesNo.no) },
          { key: 'order', header: yesNo.order, numeric: true, cell: (r) => r.displayOrder },
          {
            key: 'actions',
            header: adminDict.form.actions,
            cell: (r) => (
              <RowActions
                entity="person"
                id={r.id}
                actor={actor}
                returnTo="/admin/people"
                label={r.nameAr}
              />
            ),
          },
        ]}
      />
    </>
  );
}
