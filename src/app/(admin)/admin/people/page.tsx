import { DataTable } from '@/components/admin/controls';
import { AdminHeader } from '@/components/admin/shell';
import { listAdminPeople } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { ADMIN_OPTIONS } from '@/lib/admin-options';

export const dynamic = 'force-dynamic';

const categoryLabel = Object.fromEntries(
  ADMIN_OPTIONS.personCategory.map((o) => [o.value, o.label]),
) as Record<string, string>;

export default async function PeopleAdminPage() {
  const actor = await requireAuth();
  const rows = await listAdminPeople(actor);

  return (
    <>
      <AdminHeader
        title="الأشخاص"
        description="النشر على الموقع اختياري لكل شخص على حدة — القائمة كاملة هنا، والموقع يعرض من وافق فقط."
      />

      <DataTable
        rows={rows}
        empty="لا أشخاص."
        columns={[
          { key: 'name', header: 'الاسم', cell: (r) => r.nameAr },
          { key: 'role', header: 'الصفة', cell: (r) => r.roleAr },
          { key: 'category', header: 'الفئة', cell: (r) => categoryLabel[r.category] ?? r.category },
          { key: 'public', header: 'يظهر على الموقع', cell: (r) => (r.isPublic ? 'نعم' : 'لا') },
          { key: 'order', header: 'الترتيب', numeric: true, cell: (r) => r.displayOrder },
        ]}
      />
    </>
  );
}
