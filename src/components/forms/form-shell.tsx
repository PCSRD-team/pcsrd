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

      {/* The region itself is always in the DOM; only its contents change.
          A live region that does not exist when its content arrives is
          unreliable — assistive technology has nothing to observe until the
          node appears, and for a polite region it frequently never announces.
          This one is assertive and usually survives insertion, but "usually" is
          not what a form-level failure message should depend on. */}
      <div aria-live="assertive" role="alert">
        {state && !state.ok ? (
          <div className="rule-edge border-gold-600 bg-gold-050 p-4">
            <p className="text-small text-ink">{resolveKey(dict, state.messageKey)}</p>
          </div>
        ) : null}
      </div>

      {children(errors)}

      <Turnstile locale={locale} />

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-xl bg-navy-700 px-7 py-3 text-small font-semibold text-paper shadow-[0_10px_24px_rgb(37_66_132/0.18)] transition hover:bg-navy-900 disabled:opacity-60"
      >
        {pending ? dict.common.submitting : (submitLabel ?? dict.common.submit)}
      </button>
    </form>
  );
}
