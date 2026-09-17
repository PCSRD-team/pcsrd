import { adminDict, adminFormDict } from '@/components/admin/admin-dict';
import { adminUi } from '@/components/admin/admin-ui-dict';
import { DateCell } from '@/components/admin/controls';
import { Flash } from '@/components/admin/flash';
import { InviteUserForm } from '@/components/admin/invite-user-form';
import { AdminHeader } from '@/components/admin/shell';
import { UserActions } from '@/components/admin/user-actions';
import { Badge } from '@/components/ui/badge';
import { Bidi } from '@/components/ui/bidi';
import { EmptyState } from '@/components/ui/feedback';
import { Table } from '@/components/ui/table';
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
  const ui = adminUi.users;

  return (
    <>
      <AdminHeader title={t.title} description={t.description} />

      <Flash searchParams={search} />

      <div className="mbe-8">
        <InviteUserForm dict={adminFormDict()} />
      </div>

      <Table
        caption={t.title}
        captionHidden
        rows={users}
        empty={<EmptyState title={ui.empty} body={ui.emptyBody} />}
        columns={[
          {
            key: 'name',
            header: ui.columns.name,
            rowHeader: true,
            cell: (u) => (
              <>
                {u.fullName}
                {u.id === actor.id ? (
                  <span className="ms-2 font-mono text-eyebrow text-mono-muted">({t.you})</span>
                ) : null}
              </>
            ),
          },
          {
            key: 'email',
            header: t.email,
            numeric: true,
            align: 'start',
            cell: (u) => <Bidi>{u.email}</Bidi>,
          },
          { key: 'role', header: t.role, cell: (u) => t.roles[u.role] },
          {
            key: 'sensitive',
            header: ui.columns.sensitive,
            cell: (u) => (u.canViewSensitive ? <Badge tone="warning">{t.sensitiveAllowed}</Badge> : '—'),
          },
          {
            key: 'active',
            header: ui.columns.status,
            cell: (u) => (
              <Badge tone={u.isActive ? 'success' : 'complete'}>{u.isActive ? t.active : t.inactive}</Badge>
            ),
          },
          {
            key: 'login',
            header: t.lastLogin,
            numeric: true,
            align: 'start',
            cell: (u) => (u.lastLoginAt ? <DateCell value={u.lastLoginAt} /> : t.never),
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
