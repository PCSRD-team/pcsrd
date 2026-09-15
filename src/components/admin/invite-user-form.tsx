'use client';

import { useActionState } from 'react';
import { type EntityResult, inviteUserForm } from '@/actions/admin/entity-forms';
import {
  CheckboxField,
  EnumSelect,
  Field,
  fieldDescribedBy,
  inputClass,
} from '@/components/admin/controls';
import { ADMIN_OPTIONS } from '@/lib/admin-options';
import { type AdminFormDict, resolveAdminKey } from './admin-dict';

/**
 * Invite a user.
 *
 * A Client Component for `useActionState`, so a duplicate address lands on the
 * email input; it submits natively before hydration. Role defaults to editor —
 * least privilege — and confidential-complaint access is a separate, explicit
 * tick that the admin role never implies.
 */
export function InviteUserForm({ dict }: { dict: AdminFormDict }) {
  const [state, formAction, pending] = useActionState<EntityResult | null, FormData>(
    inviteUserForm,
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const firstError = (field: string) => {
    const key = errors?.[field]?.[0];
    return key ? resolveAdminKey(dict, key) : undefined;
  };
  const hasFieldErrors = Boolean(errors && Object.keys(errors).some((k) => k !== '_form'));
  const t = dict.admin.users;

  return (
    <form action={formAction} className="rule-edge bg-paper p-5">
      <h2 className="text-small font-semibold text-ink">{t.invite}</h2>
      <span className="rule-mark mbs-2 mbe-2 block" aria-hidden="true" />
      <p className="mbe-4 text-caption text-ink-55">{t.inviteHint}</p>

      {state && !state.ok ? (
        <div className="rule-edge mbe-4 border-gold-600 bg-gold-050 p-3" role="alert">
          <p className="text-small text-ink">
            {hasFieldErrors
              ? resolveAdminKey(dict, 'admin.form.checkFields')
              : resolveAdminKey(dict, state.messageKey)}
          </p>
        </div>
      ) : null}

      <fieldset disabled={pending} className="grid gap-4 md:grid-cols-2">
        <Field name="email" label={t.email} error={firstError('email')} required>
          <input
            id="email"
            name="email"
            type="email"
            dir="ltr"
            required
            autoComplete="off"
            aria-invalid={firstError('email') ? true : undefined}
            aria-describedby={fieldDescribedBy('email', undefined, firstError('email'))}
            className={inputClass}
          />
        </Field>
        <Field name="fullName" label={t.fullName} error={firstError('fullName')} required>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            aria-invalid={firstError('fullName') ? true : undefined}
            aria-describedby={fieldDescribedBy('fullName', undefined, firstError('fullName'))}
            className={inputClass}
          />
        </Field>
        <EnumSelect
          name="role"
          label={t.role}
          required
          defaultValue="editor"
          options={[...ADMIN_OPTIONS.userRole]}
          error={firstError('role')}
        />
        <div className="self-end">
          <CheckboxField
            name="canViewSensitive"
            label={t.grantSensitive}
            hint={dict.admin.users.description}
            error={firstError('canViewSensitive')}
          />
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="mbs-4 min-h-11 bg-navy-700 px-5 py-2 text-small font-medium text-paper hover:bg-navy-900 disabled:opacity-60"
      >
        {t.sendInvite}
      </button>
    </form>
  );
}
