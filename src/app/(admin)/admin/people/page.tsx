import Link from 'next/link';
import { adminDict } from '@/components/admin/admin-dict';
import { DataTable } from '@/components/admin/controls';
import { Flash } from '@/components/admin/flash';
import { RowActions } from '@/components/admin/row-actions';
import { AdminHeader } from '@/components/admin/shell';
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

  return (
    <>
      <AdminHeader
        title="الأشخاص"
        description="النشر على الموقع اختياري لكل شخص على حدة — القائمة كاملة هنا، والموقع يعرض من وافق فقط."
        action={
          <Link
            href="/admin/people/new"
            className="bg-navy-700 px-5 py-2 text-small font-medium text-paper no-underline hover:bg-navy-900"
          >
            {adminDict.form.add}
          </Link>
        }
      />

      <Flash searchParams={search} />

      <DataTable
        rows={rows}
        rowHref={(r) => `/admin/people/${r.id}`}
        empty="لا أشخاص."
        columns={[
          { key: 'name', header: 'الاسم', cell: (r) => r.nameAr },
          { key: 'role', header: 'الصفة', cell: (r) => r.roleAr },
          { key: 'category', header: 'الفئة', cell: (r) => categoryLabel[r.category] ?? r.category },
          { key: 'public', header: 'يظهر على الموقع', cell: (r) => (r.isPublic ? 'نعم' : 'لا') },
          { key: 'order', header: 'الترتيب', numeric: true, cell: (r) => r.displayOrder },
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
