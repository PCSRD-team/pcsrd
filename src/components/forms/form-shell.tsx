'use client';

import { useActionState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { SubmissionResult } from '@/actions/public/forms';
import type { ActionErr } from '@/lib/errors';
import type { FormValues } from '@/lib/validation/common';
import { FormActions, FormStack } from '@/components/ui/field';
import { SubmissionReceipt } from '@/components/ui/feedback';
import { LiveRegion, Notice } from '@/components/ui/notice';
import { SubmitButton } from '@/components/ui/submit-button';
import { type FieldState, type FormDict, Honeypot, resolveKey } from './fields';
import { Turnstile } from './turnstile';

/**
 * The one shell behind the five public forms and the careers portal's forms.
 *
 * **A Client Component, and the reason is `useActionState`.** It is the only
 * way React hands an action's return value back to the form — with JavaScript
 * *and* without it. On a plain POST, React replays the action on the server
 * and renders this component with the result already in `state`, so field
 * errors, the typed values and the receipt all appear in server-rendered HTML.
 * Nothing about that path depends on hydration; what the client adds is doing
 * it without a full navigation, which matters where a round trip costs
 * seconds. This is rule 7 kept, not bent.
 *
 * `method` and `encType` are not set on the `<form>`: React sets both
 * (`POST`, `multipart/form-data`) for any form whose action is a function and
 * warns if a caller sets them too. A portal form's file fields therefore
 * travels correctly before hydration without a prop for it.
 *
 * The fields are a render prop rather than children because they need the
 * state that only exists after a submission. Everything a form has in common
 * lives here — the locale, the honeypot, the result region, the captcha and
 * the submit — so a per-form component declares fields and nothing else.
 */

export type SubmissionState = SubmissionResult | null;

/**
 * What the shell needs an action to return.
 *
 * Generic over the success payload rather than pinned to `SubmissionResult`,
 * because the careers portal's action returns one extra field — whether the
 * application landed on a waiting list — and that changes what the receipt
 * says. The alternative was a second shell, which would have been this file
 * copied with four words different and would have drifted the first time
 * anything about the captcha, the honeypot or the live region changed.
 *
 * `reference` is the one thing every form must produce. It is the handle a
 * person quotes when they follow up, and a receipt without one is a receipt
 * that helps nobody.
 */
export type ShellOk<TData extends { reference: string }> = {
  ok: true;
  data: TData;
  messageKey?: string;
};

export type ShellErr = ActionErr & { values?: FormValues };

export type ShellResult<TData extends { reference: string }> = ShellOk<TData> | ShellErr;

export function FormShell<TData extends { reference: string } = { reference: string }>({
  action,
  dict,
  locale,
  submitLabel,
  children,
  renderReceipt,
  intro,
}: {
  action: (
    prev: ShellResult<TData> | null,
    formData: FormData,
  ) => Promise<ShellResult<TData> | null>;
  dict: FormDict;
  locale: 'ar' | 'en';
  submitLabel?: string;
  children: (state: FieldState) => ReactNode;
  /** Overrides the default receipt when a form has more to say than a number. */
  renderReceipt?: (data: TData) => ReactNode;
  /** Rendered above the fields, inside the form, after any failure notice. */
  intro?: ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Where focus goes after a refusal. The submit button is disabled while the
  // action runs, so the browser drops focus to <body> and a keyboard or
  // screen-reader user is sent back to the top of the page. The first invalid
  // field is where they need to be; failing that — a captcha or rate-limit
  // refusal names no field — the submit button they just pressed. The
  // assertive live region still announces the message either way.
  useEffect(() => {
    if (!state || state.ok) return;
    const form = formRef.current;
    const target =
      form?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      form?.querySelector<HTMLElement>('button[type="submit"]');
    target?.focus();
  }, [state]);

  if (state?.ok) {
    return (
      renderReceipt?.(state.data) ?? (
        <SubmissionReceipt
          title={dict.forms.successWithReference}
          reference={state.data.reference}
          body={dict.forms.keepReference}
        />
      )
    );
  }

  const failure = state && !state.ok ? state : null;
  const fieldState: FieldState = failure
    ? { errors: failure.fieldErrors, values: failure.values }
    : {};

  return (
    // `noValidate`: the server is the validator, and its messages are the
    // translated ones. The browser's own bubbles would pre-empt them in the
    // browser's language, not the page's.
    <form ref={formRef} action={formAction} noValidate className="grid gap-6">
      {/* The locale travels with the submission so the acknowledgement email is
          written in the language the sender used, not the language of whoever
          reads the inbox. */}
      <input type="hidden" name="locale" value={locale} />
      <Honeypot />

      {/* Always in the DOM; only its contents change. A live region that does
          not exist when its content arrives is unreliable — assistive
          technology has nothing to observe until the node appears. Assertive:
          a failed submission must interrupt. The notice inside is `live="off"`
          so the message is announced once, by the region, not twice. */}
      <LiveRegion assertive>
        {failure ? (
          <Notice tone="danger" live="off">
            {resolveKey(dict, failure.messageKey)}
          </Notice>
        ) : null}
      </LiveRegion>

      {intro}

      <FormStack>{children(fieldState)}</FormStack>

      <Turnstile locale={locale} dict={dict} />

      <FormActions>
        <SubmitButton
          label={submitLabel ?? dict.common.submit}
          pendingLabel={dict.common.submitting}
        />
      </FormActions>
    </form>
  );
}
