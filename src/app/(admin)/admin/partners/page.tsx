import { DataTable } from '@/components/admin/controls';
import { AdminHeader } from '@/components/admin/shell';
import { listAdminPartners } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { ADMIN_OPTIONS } from '@/lib/admin-options';

export const dynamic = 'force-dynamic';

const PERMISSION_LABEL: Record<string, string> = {
  granted: 'ممنوح',
  pending: 'قيد الانتظار',
  denied: 'مرفوض',
};

const typeLabel = Object.fromEntries(
  ADMIN_OPTIONS.partnerType.map((o) => [o.value, o.label]),
) as Record<string, string>;

export default async function PartnersAdminPage() {
  const actor = await requireAuth();
  const rows = await listAdminPartners(actor);

  return (
    <>
      <AdminHeader
        title="الشركاء"
        description="لا يُعرض شعار الشريك على الموقع إلا إذا كان الإذن ممنوحاً."
      />

      <DataTable
        rows={rows}
        empty="لا شركاء."
        columns={[
          { key: 'name', header: 'الاسم', cell: (r) => r.nameAr },
          { key: 'type', header: 'النوع', cell: (r) => typeLabel[r.type] ?? r.type },
          {
            key: 'logo',
            header: 'إذن الشعار',
            cell: (r) => PERMISSION_LABEL[r.logoPermission] ?? r.logoPermission,
          },
          { key: 'status', header: 'الحالة', cell: (r) => (r.status === 'published' ? 'منشور' : 'مسودة') },
          { key: 'order', header: 'الترتيب', numeric: true, cell: (r) => r.displayOrder },
        ]}
      />
    </>
  );
}
