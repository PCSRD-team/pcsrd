import { adminDict, adminFormDict } from '@/components/admin/admin-dict';
import { DataTable, TimeCell } from '@/components/admin/controls';
import { Flash } from '@/components/admin/flash';
import { InviteUserForm } from '@/components/admin/invite-user-form';
import { AdminHeader } from '@/components/admin/shell';
import { UserActions } from '@/components/admin/user-actions';
import { Bidi } from '@/components/ui/bidi';
import { listUsers } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { assertCan } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

/**
 * Users. `users.manage` — admin only.
 *
 * Invitations go through Supabase Auth's admin API; the `handle_new_user`
 * trigger creates the profile with least privilege, and anything above that is
 * an explicit, audited grant. `guard_profile_privileges` refuses a self
 * promotion at the database level — a metadata write must never be able to
 * decide a role — and the service refuses it first with a translated message.
 */
export default async function UsersPage({ searchParams }: PageProps<'/admin/users'>) {
  const [actor, search] = await Promise.all([requireAuth(), searchParams]);
  assertCan(actor, 'users.manage');

  const users = await listUsers(actor);
  const t = adminDict.users;

  return (
    <>
      <AdminHeader title={t.title} description={t.description} />

      <Flash searchParams={search} />

      <div className="mbe-8">
        <InviteUserForm dict={adminFormDict()} />
      </div>

      <DataTable
        rows={users}
        empty="لا مستخدمين."
        columns={[
          {
            key: 'name',
            header: 'الاسم',
            cell: (u) => (
              <>
                {u.fullName}
                {u.id === actor.id ? (
                  <span className="ms-2 font-mono text-eyebrow text-mono-muted">({t.you})</span>
                ) : null}
              </>
            ),
          },
          { key: 'email', header: t.email, numeric: true, cell: (u) => <Bidi>{u.email}</Bidi> },
          { key: 'role', header: t.role, cell: (u) => t.roles[u.role] },
          {
            key: 'sensitive',
            header: 'الشكاوى السرّية',
            cell: (u) => (u.canViewSensitive ? t.sensitiveAllowed : '—'),
          },
          { key: 'active', header: 'الحالة', cell: (u) => (u.isActive ? t.active : t.inactive) },
          {
            key: 'login',
            header: t.lastLogin,
            numeric: true,
            cell: (u) => (u.lastLoginAt ? <TimeCell value={u.lastLoginAt} /> : t.never),
          },
          {
            key: 'actions',
            header: adminDict.form.actions,
            cell: (u) => <UserActions user={u} actor={actor} />,
          },
        ]}
      />
    </>
  );
}
