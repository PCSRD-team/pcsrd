import { DataTable, TimeCell } from '@/components/admin/controls';
import { AdminHeader } from '@/components/admin/shell';
import { listUsers } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { assertCan } from '@/services/_shared/permissions';
import type { UserRole } from '@/db/schema/enums';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'مدير',
  content_manager: 'مسؤول محتوى',
  editor: 'محرّر',
};

/**
 * Users.
 *
 * Roles are changed through Supabase Auth plus a direct profile update, and the
 * `guard_profile_privileges` trigger refuses a self-promotion at the database
 * level — a metadata write must never be able to decide a role.
 */
export default async function UsersPage() {
  const actor = await requireAuth();
  assertCan(actor, 'users.manage');

  const users = await listUsers(actor);

  return (
    <>
      <AdminHeader
        title="المستخدمون"
        description="صلاحية قراءة الشكاوى السرّية تُمنح لكل شخص على حدة، ولا يمنحها دور المدير تلقائياً."
      />

      <DataTable
        rows={users}
        empty="لا مستخدمين."
        columns={[
          { key: 'name', header: 'الاسم', cell: (u) => u.fullName },
          { key: 'email', header: 'البريد', numeric: true, cell: (u) => u.email },
          { key: 'role', header: 'الدور', cell: (u) => ROLE_LABEL[u.role] },
          {
            key: 'sensitive',
            header: 'الشكاوى السرّية',
            cell: (u) => (u.canViewSensitive ? 'مسموح' : '—'),
          },
          { key: 'active', header: 'الحالة', cell: (u) => (u.isActive ? 'نشط' : 'موقوف') },
          {
            key: 'login',
            header: 'آخر دخول',
            numeric: true,
            cell: (u) => (u.lastLoginAt ? <TimeCell value={u.lastLoginAt} /> : '—'),
          },
        ]}
      />
    </>
  );
}
