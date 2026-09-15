import Link from 'next/link';
import { adminDict } from '@/components/admin/admin-dict';
import { DataTable, StatusBadge } from '@/components/admin/controls';
import { Flash } from '@/components/admin/flash';
import { RowActions } from '@/components/admin/row-actions';
import { AdminHeader } from '@/components/admin/shell';
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

  return (
    <>
      <AdminHeader
        title="الشركاء"
        description="لا يُعرض شعار الشريك على الموقع إلا إذا كان الإذن ممنوحاً."
        action={
          <Link
            href="/admin/partners/new"
            className="bg-navy-700 px-5 py-2 text-small font-medium text-paper no-underline hover:bg-navy-900"
          >
            {adminDict.form.add}
          </Link>
        }
      />

      <Flash searchParams={search} />

      <DataTable
        rows={rows}
        rowHref={(r) => `/admin/partners/${r.id}`}
        empty="لا شركاء."
        columns={[
          { key: 'name', header: 'الاسم', cell: (r) => r.nameAr },
          { key: 'type', header: 'النوع', cell: (r) => typeLabel[r.type] ?? r.type },
          {
            key: 'logo',
            header: 'إذن الشعار',
            cell: (r) => permissionLabel[r.logoPermission] ?? r.logoPermission,
          },
          { key: 'status', header: 'الحالة', cell: (r) => <StatusBadge status={r.status} /> },
          { key: 'order', header: 'الترتيب', numeric: true, cell: (r) => r.displayOrder },
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
