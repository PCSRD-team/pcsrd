'use client';

import { useActionState } from 'react';
import type { ReactNode } from 'react';
import type { ActionResult, FieldErrors } from '@/lib/errors';
import { type FormDict, SubmissionReceipt, resolveKey } from './fields';
import { Turnstile } from './turnstile';

/**
 * **A Client Component, and the reason is `useActionState`.**
 *
 * Progressive enhancement is not lost by this: React submits the form natively
 * before hydration, so the six public forms work with JavaScript disabled —
 * rule 7. What the client adds is showing field errors and the reference number
 * without a full navigation, which matters on a connection where a round trip
 * costs several seconds.
 *
 * The fields are passed in as a render prop rather than as children, because
 * they need the errors that only exist after a submission.
 */

export type SubmissionState = ActionResult<{ reference: string }> | null;

export function FormShell({
  action,
  dict,
  locale,
  submitLabel,
  encType,
  children,
}: {
  action: (prev: SubmissionState, formData: FormData) => Promise<SubmissionState>;
  dict: FormDict;
  locale: 'ar' | 'en';
  submitLabel?: string;
  /** `multipart/form-data` for the one form that carries a file. */
  encType?: 'multipart/form-data';
  children: (errors: FieldErrors | undefined) => ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  if (state?.ok) {
    return <SubmissionReceipt reference={state.data.reference} dict={dict} />;
  }

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} encType={encType} className="space-y-6" noValidate>
      {/* The locale travels with the submission so the acknowledgement email is
          written in the language the sender used, not the language of whoever
          reads the inbox. */}
      <input type="hidden" name="locale" value={locale} />

      {state && !state.ok ? (
        <div className="rule-edge border-gold-600 bg-gold-050 p-4" role="alert">
          <p className="text-small text-ink">{resolveKey(dict, state.messageKey)}</p>
        </div>
      ) : null}

      {children(errors)}

      <Turnstile locale={locale} />

      <button
        type="submit"
        disabled={pending}
        className="bg-navy-700 px-6 py-3 text-small font-medium text-paper hover:bg-navy-900 disabled:opacity-60"
      >
        {pending ? dict.common.submitting : (submitLabel ?? dict.common.submit)}
      </button>
    </form>
  );
}
