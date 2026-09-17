'use client';
// Client Component: `useActionState`, so a duplicate address lands on the
// email input. It still submits natively before hydration.

import { useActionState, useId } from 'react';
import { type EntityResult, inviteUserForm } from '@/actions/admin/entity-forms';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { Field, FieldRow } from '@/components/ui/field';
import { Checkbox, Input, Select } from '@/components/ui/inputs';
import { Rule } from '@/components/ui/layout';
import { Notice } from '@/components/ui/notice';
import { Caption, Heading } from '@/components/ui/typography';
import { ADMIN_OPTIONS } from '@/lib/admin-options';
import { type AdminFormDict, resolveAdminKey } from './admin-dict';

/**
 * Invite a user.
 *
 * Role defaults to editor — least privilege — and confidential-complaint
 * access is a separate, explicit tick that the admin role never implies.
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
  const headingId = useId();

  return (
    <Panel as="section" tone="paper" padding="md" labelledBy={headingId}>
      <form action={formAction}>
        <Heading level={2} size="h4" id={headingId}>
          {t.invite}
        </Heading>
        <Rule weight="mark" as="span" className="mbs-2 mbe-2" />
        <Caption className="mbe-4">{t.inviteHint}</Caption>

        {state && !state.ok ? (
          <Notice tone="danger" className="mbe-4">
            {hasFieldErrors
              ? resolveAdminKey(dict, 'admin.form.checkFields')
              : resolveAdminKey(dict, state.messageKey)}
          </Notice>
        ) : null}

        <fieldset disabled={pending}>
          <FieldRow>
            <Field name="email" label={t.email} error={firstError('email')} required>
              <Input
                name="email"
                type="email"
                required
                autoComplete="off"
                error={firstError('email')}
              />
            </Field>
            <Field name="fullName" label={t.fullName} error={firstError('fullName')} required>
              <Input name="fullName" type="text" required error={firstError('fullName')} />
            </Field>
            <Field name="role" label={t.role} error={firstError('role')} required>
              <Select
                name="role"
                required
                defaultValue="editor"
                placeholder={null}
                options={[...ADMIN_OPTIONS.userRole]}
                error={firstError('role')}
              />
            </Field>
            <Checkbox
              name="canViewSensitive"
              label={t.grantSensitive}
              hint={dict.admin.users.description}
              error={firstError('canViewSensitive')}
              className="self-end"
            />
          </FieldRow>
        </fieldset>

        <Button type="submit" loading={pending} className="mbs-6">
          {t.sendInvite}
        </Button>
      </form>
    </Panel>
  );
}
