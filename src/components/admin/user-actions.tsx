import {
  changeUserActive,
  changeUserRole,
  changeUserSensitiveAccess,
} from '@/actions/admin/catalog';
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
 */

const button = 'rule-edge px-3 py-1 text-caption text-ink hover:bg-paper-alt whitespace-nowrap';
const marked = 'rule-edge border-gold-600 px-3 py-1 text-caption text-gold-700 hover:bg-gold-050 whitespace-nowrap';

export function UserActions({ user, actor }: { user: Profile; actor: Actor }) {
  const t = adminDict.users;
  if (user.id === actor.id) {
    return <span className="text-caption text-ink-55">{t.selfHint}</span>;
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
      <form action={changeUserRole} className="flex items-center gap-1">
        <input type="hidden" name="userId" value={user.id} />
        <label htmlFor={`role-${user.id}`} className="sr-only">
          {t.role}
        </label>
        <select
          id={`role-${user.id}`}
          name="role"
          defaultValue={user.role}
          className="rule-edge bg-paper px-2 py-1 text-caption"
        >
          {ADMIN_OPTIONS.userRole.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="submit" className={button}>
          {t.setRole}
        </button>
      </form>

      <form action={changeUserSensitiveAccess}>
        <input type="hidden" name="userId" value={user.id} />
        <input type="hidden" name="value" value={user.canViewSensitive ? 'false' : 'true'} />
        <button type="submit" className={user.canViewSensitive ? marked : button}>
          {user.canViewSensitive ? t.revokeSensitive : t.grantSensitive}
        </button>
      </form>

      {user.isActive ? (
        <details>
          <summary className={`${marked} inline-block cursor-pointer list-none`}>
            {t.deactivate}
          </summary>
          <form action={changeUserActive} className="mbs-2">
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="value" value="false" />
            <button type="submit" className={marked}>
              {t.confirmDeactivate}
            </button>
          </form>
        </details>
      ) : (
        <form action={changeUserActive}>
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="value" value="true" />
          <button type="submit" className={button}>
            {t.reactivate}
          </button>
        </form>
      )}
    </div>
  );
}
