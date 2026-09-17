import {
  changeUserActive,
  changeUserRole,
  changeUserSensitiveAccess,
} from '@/actions/admin/catalog';
import { Button, buttonClasses } from '@/components/ui/button';
import { Cluster } from '@/components/ui/layout';
import { Caption } from '@/components/ui/typography';
import type { Profile } from '@/db/schema/profiles';
import { ADMIN_OPTIONS } from '@/lib/admin-options';
import type { Actor } from '@/services/_shared/actor';
import { adminDict } from './admin-dict';

/**
 * Per-user controls: role, confidential-complaint access, activation.
 *
 * Plain forms — no JavaScript needed. The actor's own row shows none of them:
 * the service refuses a self role-change and a self-deactivation, and the
 * database trigger refuses the first again, so rendering the buttons would
 * only be rendering a refusal. Sensitive access on one's own row is refused
 * here for the same reason it is granted per person by policy: it is not a
 * thing one grants oneself.
 *
 * The role select is a native `<select className="control">` rather than the
 * kit's `Select`: the kit derives the control's `id` from `name`, and one
 * `role` select per row would produce duplicate ids. The `control` utility
 * is the same one the kit wears.
 */
export function UserActions({ user, actor }: { user: Profile; actor: Actor }) {
  const t = adminDict.users;
  if (user.id === actor.id) {
    return <Caption as="span">{t.selfHint}</Caption>;
  }

  return (
    <Cluster gap={2} align="start">
      <form action={changeUserRole} className="flex items-center gap-1">
        <input type="hidden" name="userId" value={user.id} />
        <label htmlFor={`role-${user.id}`} className="sr-only">
          {t.role}
        </label>
        <select
          id={`role-${user.id}`}
          name="role"
          defaultValue={user.role}
          className="control w-auto min-w-36 text-caption"
        >
          {ADMIN_OPTIONS.userRole.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" tone="secondary">
          {t.setRole}
        </Button>
      </form>

      <form action={changeUserSensitiveAccess}>
        <input type="hidden" name="userId" value={user.id} />
        <input type="hidden" name="value" value={user.canViewSensitive ? 'false' : 'true'} />
        <Button type="submit" size="sm" tone={user.canViewSensitive ? 'marked' : 'secondary'}>
          {user.canViewSensitive ? t.revokeSensitive : t.grantSensitive}
        </Button>
      </form>

      {user.isActive ? (
        <details>
          <summary
            className={buttonClasses({ tone: 'danger', size: 'sm', className: 'cursor-pointer list-none' })}
          >
            {t.deactivate}
          </summary>
          <form action={changeUserActive} className="mbs-2">
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="value" value="false" />
            <Button type="submit" size="sm" tone="danger">
              {t.confirmDeactivate}
            </Button>
          </form>
        </details>
      ) : (
        <form action={changeUserActive}>
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="value" value="true" />
          <Button type="submit" size="sm" tone="secondary">
            {t.reactivate}
          </Button>
        </form>
      )}
    </Cluster>
  );
}
