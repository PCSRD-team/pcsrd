'use client';
// Client Component: `useActionState` shows a refused decision's errors on the
// field that caused them without a navigation. The form still submits
// natively before hydration — the action redirects back here with a flash.

import { useActionState } from 'react';
import type { DonationFormResult } from '@/actions/admin/donations';
import { Panel } from '@/components/ui/card';
import { Field, FieldRow } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/inputs';
import { Cluster, Stack } from '@/components/ui/layout';
import { Notice } from '@/components/ui/notice';
import { SubmitButton } from '@/components/ui/submit-button';
import { Caption, Heading } from '@/components/ui/typography';
import { type AdminFormDict, resolveAdminKey } from './admin-dict';
import { adminUi } from './admin-ui-dict';
import { submitKeepingValues } from './donation-account-form';

/**
 * The matching decision: confirm, reject, or only keep a note.
 *
 * One form with three submit buttons named `decision`, like the publish bar:
 * the amount, the receipt number and the note are read the same way whichever
 * decision is taken, and three forms would mean typing the note three times.
 *
 * The confirmed amount starts as the declared one because that is the usual
 * case, and the hint says why it may differ — an international transfer
 * arrives short by the bank's charges, and the books must show what arrived.
 */
export function DonationReview({
  action,
  values,
  dict,
}: {
  action: (prev: DonationFormResult | null, formData: FormData) => Promise<DonationFormResult>;
  values: {
    id: string;
    currency: string;
    amount: string;
    confirmedAmount: string | null;
    receiptNumber: string | null;
    internalNote: string | null;
  };
  dict: AdminFormDict;
}) {
  const [state, formAction] = useActionState<DonationFormResult | null, FormData>(action, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const error = (name: string) => errors?.[name]?.map((key) => resolveAdminKey(dict, key));
  const t = adminUi.donations.review;
  const saving = adminUi.form.saving;

  return (
    <Panel as="section" tone="white" padding="md" labelledBy="donation-review">
      <Heading level={2} size="h4" id="donation-review">
        {t.title}
      </Heading>
      <Caption className="mbs-1 mbe-6">{t.lede}</Caption>

      <form action={formAction} onSubmit={submitKeepingValues(formAction)} noValidate>
        <input type="hidden" name="id" value={values.id} />

        {state && !state.ok ? (
          <Notice tone="danger" className="mbe-6">
            {resolveAdminKey(dict, state.messageKey)}
          </Notice>
        ) : null}

        <Stack gap={6}>
          <FieldRow>
            <Field
              name="confirmedAmount"
              label={`${t.confirmedAmount} (${values.currency})`}
              hint={t.confirmedAmountHint}
              error={error('confirmedAmount')}
            >
              <Input
                name="confirmedAmount"
                inputMode="decimal"
                dir="ltr"
                autoComplete="off"
                defaultValue={values.confirmedAmount ?? values.amount}
                hint={t.confirmedAmountHint}
                error={error('confirmedAmount')}
              />
            </Field>
            <Field
              name="receiptNumber"
              label={t.receiptNumber}
              hint={t.receiptNumberHint}
              error={error('receiptNumber')}
            >
              <Input
                name="receiptNumber"
                dir="ltr"
                autoComplete="off"
                defaultValue={values.receiptNumber ?? ''}
                hint={t.receiptNumberHint}
                error={error('receiptNumber')}
              />
            </Field>
          </FieldRow>

          <Field
            name="internalNote"
            label={t.internalNote}
            hint={t.internalNoteHint}
            error={error('internalNote')}
          >
            <Textarea
              name="internalNote"
              rows={4}
              defaultValue={values.internalNote ?? ''}
              hint={t.internalNoteHint}
              error={error('internalNote')}
            />
          </Field>
        </Stack>

        <Cluster gap={3} className="mbs-8">
          <SubmitButton name="decision" value="confirm" label={t.confirm} pendingLabel={saving} />
          <SubmitButton
            name="decision"
            value="reject"
            tone="danger"
            label={t.reject}
            pendingLabel={saving}
          />
          <SubmitButton
            name="decision"
            value="note"
            tone="secondary"
            label={t.note}
            pendingLabel={saving}
          />
        </Cluster>
      </form>
    </Panel>
  );
}
