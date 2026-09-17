'use client';
// Client Component: `useActionState` places the sign-in error next to the
// form without a full navigation. It still submits natively before hydration.

import { useActionState } from 'react';
import { type AuthResult, signIn } from '@/actions/admin/auth';
import { Button } from '@/components/ui/button';
import { Field, FormStack } from '@/components/ui/field';
import { Input } from '@/components/ui/inputs';
import { LiveRegion, Notice } from '@/components/ui/notice';
import { Caption } from '@/components/ui/typography';
import { adminUi } from './admin-ui-dict';

/**
 * The sign-in form.
 *
 * The error message is deliberately the same for a wrong password and an
 * unknown address — see `signIn`. The keys the action returns are resolved
 * against `adminUi.login.messages`; anything else falls back to the generic
 * sentence rather than echoing the key.
 */
export function LoginForm() {
  const [state, formAction, pending] = useActionState<AuthResult | null, FormData>(signIn, null);
  const t = adminUi.login;
  const messages: Record<string, string> = t.messages;
  const failed = state && !state.ok ? state : null;

  return (
    <form action={formAction}>
      <FormStack>
        <LiveRegion assertive>
          {failed ? (
            <Notice tone="danger" live="off">
              {messages[failed.messageKey] ?? messages['errors.unexpected']}
            </Notice>
          ) : null}
        </LiveRegion>

        <Field name="email" label={t.email} required>
          <Input
            name="email"
            type="email"
            required
            autoComplete="username"
            placeholder="name@example.com"
          />
        </Field>

        <Field name="password" label={t.password} required>
          <Input
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </Field>

        <Button type="submit" size="lg" loading={pending} className="w-full">
          {pending ? t.pending : t.submit}
        </Button>

        <Caption className="text-center">{t.secure}</Caption>
      </FormStack>
    </form>
  );
}
