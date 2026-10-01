'use client';
// Client Component: `useActionState` places a rejected save's errors on the
// fields that caused them — an IBAN with a wrong check digit is the case this
// form exists for. The form still submits natively before hydration.

import { type FormEvent, startTransition, useActionState } from 'react';
import type { DonationFormResult } from '@/actions/admin/donations';
import { Button } from '@/components/ui/button';
import { Field, FieldRow } from '@/components/ui/field';
import { Checkbox, Input, Select } from '@/components/ui/inputs';
import { Stack } from '@/components/ui/layout';
import { Notice } from '@/components/ui/notice';
import { DONATION_CURRENCIES, formatIban } from '@/lib/donations/options';
import { type AdminFormDict, resolveAdminKey } from './admin-dict';
import { adminUi } from './admin-ui-dict';

/**
 * Submits a form through its action **without** React's automatic reset.
 *
 * A `<form action={fn}>` is reset once the action settles, whatever it
 * returned — so an IBAN refused for one wrong digit would come back as the
 * old IBAN, and the admin would have to type all 29 characters again. Taking
 * the submit over keeps what was typed. Only with JavaScript: before
 * hydration the form posts natively, exactly as before.
 *
 * The submitter rides along, so a form with several `name="decision"`
 * buttons still posts the one that was pressed.
 */
export function submitKeepingValues(formAction: (data: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(data));
  };
}

export type DonationAccountValues = {
  id?: string;
  currency: string;
  bankNameAr: string;
  bankNameEn: string | null;
  branchAr: string | null;
  branchEn: string | null;
  beneficiaryAr: string;
  beneficiaryEn: string | null;
  accountNumber: string;
  iban: string;
  swift: string | null;
  sortOrder: number;
  isActive: boolean;
};

/**
 * One bank account, new or existing.
 *
 * The warning sits above the fields, not in a hint under the IBAN: it is about
 * the whole record. The account number and IBAN are what a donor copies into
 * their bank app, and a wrong one sends real money somewhere else.
 */
export function DonationAccountForm({
  action,
  values,
  dict,
}: {
  action: (prev: DonationFormResult | null, formData: FormData) => Promise<DonationFormResult>;
  values: DonationAccountValues;
  dict: AdminFormDict;
}) {
  const [state, formAction, pending] = useActionState<DonationFormResult | null, FormData>(
    action,
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const error = (name: string) => errors?.[name]?.map((key) => resolveAdminKey(dict, key));
  const t = adminUi.donations.accounts;
  const currencies = adminUi.donations.currencies;

  return (
    <form action={formAction} onSubmit={submitKeepingValues(formAction)} noValidate>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <Notice tone="warning" title={t.warningTitle} live="off" className="mbe-6">
        {t.warningBody}
      </Notice>

      {state && !state.ok ? (
        <Notice tone="danger" className="mbe-6">
          {resolveAdminKey(dict, state.messageKey)}
        </Notice>
      ) : null}

      <Stack gap={6}>
        <FieldRow>
          <Field name="currency" label={t.currency} error={error('currency')} required>
            <Select
              name="currency"
              defaultValue={values.currency}
              required
              error={error('currency')}
              options={DONATION_CURRENCIES.map((code) => ({
                value: code,
                label: `${currencies[code]} (${code})`,
              }))}
            />
          </Field>
          <Field name="sortOrder" label={t.sortOrder} hint={t.sortOrderHint} error={error('sortOrder')}>
            <Input
              name="sortOrder"
              type="number"
              min={0}
              max={1000}
              defaultValue={values.sortOrder}
              dir="ltr"
              hint={t.sortOrderHint}
              error={error('sortOrder')}
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field name="bankNameAr" label={t.bankNameAr} error={error('bankNameAr')} required>
            <Input name="bankNameAr" defaultValue={values.bankNameAr} required error={error('bankNameAr')} />
          </Field>
          <Field name="bankNameEn" label={t.bankNameEn} error={error('bankNameEn')}>
            <Input name="bankNameEn" defaultValue={values.bankNameEn ?? ''} dir="ltr" error={error('bankNameEn')} />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field name="branchAr" label={t.branchAr} error={error('branchAr')}>
            <Input name="branchAr" defaultValue={values.branchAr ?? ''} error={error('branchAr')} />
          </Field>
          <Field name="branchEn" label={t.branchEn} error={error('branchEn')}>
            <Input name="branchEn" defaultValue={values.branchEn ?? ''} dir="ltr" error={error('branchEn')} />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field name="beneficiaryAr" label={t.beneficiaryAr} error={error('beneficiaryAr')} required>
            <Input
              name="beneficiaryAr"
              defaultValue={values.beneficiaryAr}
              required
              error={error('beneficiaryAr')}
            />
          </Field>
          <Field name="beneficiaryEn" label={t.beneficiaryEn} error={error('beneficiaryEn')}>
            <Input
              name="beneficiaryEn"
              defaultValue={values.beneficiaryEn ?? ''}
              dir="ltr"
              error={error('beneficiaryEn')}
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field name="accountNumber" label={t.accountNumber} error={error('accountNumber')} required>
            <Input
              name="accountNumber"
              defaultValue={values.accountNumber}
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              required
              error={error('accountNumber')}
            />
          </Field>
          <Field name="swift" label={t.swift} hint={t.swiftHint} error={error('swift')}>
            <Input
              name="swift"
              defaultValue={values.swift ?? ''}
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              hint={t.swiftHint}
              error={error('swift')}
            />
          </Field>
        </FieldRow>

        <Field name="iban" label={t.ibanField} hint={t.ibanHint} error={error('iban')} required>
          <Input
            name="iban"
            defaultValue={values.iban ? formatIban(values.iban) : ''}
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            required
            hint={t.ibanHint}
            error={error('iban')}
          />
        </Field>

        <Checkbox name="isActive" label={t.isActive} defaultChecked={values.isActive} />
      </Stack>

      <div className="mbs-8">
        <Button type="submit" loading={pending}>
          {pending ? adminUi.form.saving : t.save}
        </Button>
      </div>
    </form>
  );
}
