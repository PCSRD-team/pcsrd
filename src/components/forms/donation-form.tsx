'use client';

import { submitDonationNotice } from '@/actions/public/donate';
import { Field, FieldRow } from '@/components/ui/field';
import { SubmissionReceipt } from '@/components/ui/feedback';
import { Checkbox, type Option, RadioGroup, Select } from '@/components/ui/inputs';
import { Eyebrow } from '@/components/ui/typography';
import type { Locale } from '@/lib/i18n/config';
import {
  type FieldState,
  FileField,
  type FormDict,
  SelectField,
  TextArea,
  TextField,
  resolveErrors,
} from './fields';
import { FormShell } from './form-shell';

/**
 * The donation notice — a donor telling us they sent money.
 *
 * Client Component for the same reason as the other public forms: it renders
 * inside `FormShell`'s render prop. It holds no state of its own, and with
 * JavaScript off it is a plain multipart POST — the slip included.
 *
 * Every option list arrives **built**: values from `lib/donations/options`
 * (the lists the schema's enums are made from) or from the page's own read of
 * the published accounts and projects, labels from the dictionary. The
 * dictionary does not reach the browser, and the copy below is the `donate`
 * section narrowed to what the form says.
 *
 * Nothing here is required beyond what the bank statement needs to be matched
 * — the amount, the currency, the method — and the consent to keep it. A donor
 * who wants no name on the record gives none.
 */

export type DonationFormCopy = {
  submit: string;
  success: string;
  successNext: string;
  keepReference: string;
  transferGroup: string;
  donorGroup: string;
  generalPurpose: string;
  fields: {
    amount: string;
    currency: string;
    method: string;
    accountId: string;
    transferredOn: string;
    bankReference: string;
    projectId: string;
    donorName: string;
    isAnonymous: string;
    email: string;
    phone: string;
    wantsReceipt: string;
    message: string;
    attachment: string;
    consent: string;
  };
  hints: {
    amount: string;
    bankReference: string;
    attachment: string;
    donorName: string;
  };
};

export type DonationFormProps = {
  dict: FormDict;
  locale: Locale;
  copy: DonationFormCopy;
  currencies: Option[];
  methods: Option[];
  accounts: Option[];
  projects: Option[];
  /** The admin's thank-you text, shown under the receipt when there is one. */
  thankYou: string | null;
};

/** What the slip may be: the same image and PDF types the action checks by their bytes. */
const SLIP_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp';

export function DonationForm({
  dict,
  locale,
  copy,
  currencies,
  methods,
  accounts,
  projects,
  thankYou,
}: DonationFormProps) {
  const t = copy.fields;
  return (
    <FormShell
      action={submitDonationNotice}
      dict={dict}
      locale={locale}
      submitLabel={copy.submit}
      renderReceipt={(data) => (
        <div className="grid gap-4">
          <SubmissionReceipt
            title={copy.success}
            reference={data.reference}
            body={[copy.successNext, copy.keepReference].join(' ')}
          />
          {thankYou ? <p className="max-w-prose whitespace-pre-line text-body text-ink">{thankYou}</p> : null}
        </div>
      )}
    >
      {(state) => (
        <>
          <Eyebrow as="p">{copy.transferGroup}</Eyebrow>
          <FieldRow>
            {/* Digits typed into an RTL page: `ltr` keeps `1,250.50` in the
                order it is typed. `decimal` brings up the keypad with a point. */}
            <TextField
              name="amount"
              label={t.amount}
              hint={copy.hints.amount}
              dict={dict}
              required
              state={state}
              inputMode="decimal"
              dir="ltr"
              autoComplete="off"
            />
            <SelectField
              name="currency"
              label={t.currency}
              dict={dict}
              options={currencies}
              // One account, one currency: nothing to choose.
              defaultValue={currencies.length === 1 ? currencies[0]?.value : undefined}
              required
              state={state}
            />
          </FieldRow>

          <RadioGroup
            name="method"
            legend={t.method}
            options={methods}
            required
            optionalLabel={dict.common.optional}
            error={resolveErrors(dict, state.errors, 'method')}
            announce={false}
            defaultValue={
              (typeof state.values?.method === 'string' ? state.values.method : undefined) ??
              methods[0]?.value
            }
            columns={2}
          />

          {accounts.length > 0 ? (
            <SelectField name="accountId" label={t.accountId} dict={dict} options={accounts} state={state} />
          ) : null}

          <FieldRow>
            <TextField name="transferredOn" label={t.transferredOn} dict={dict} type="date" state={state} />
            <TextField
              name="bankReference"
              label={t.bankReference}
              hint={copy.hints.bankReference}
              dict={dict}
              state={state}
              dir="ltr"
              autoComplete="off"
            />
          </FieldRow>

          {/* The empty option is a real choice here, not a "pick one" prompt:
              a gift with no project goes where it is needed most. */}
          <SelectFieldWithEmpty
            dict={dict}
            label={t.projectId}
            emptyLabel={copy.generalPurpose}
            options={projects}
            state={state}
          />

          <FileField
            name="attachment"
            label={t.attachment}
            hint={copy.hints.attachment}
            dict={dict}
            accept={SLIP_ACCEPT}
            state={state}
          />

          <Eyebrow as="p" className="mbs-4">
            {copy.donorGroup}
          </Eyebrow>
          <TextField
            name="donorName"
            label={t.donorName}
            hint={copy.hints.donorName}
            dict={dict}
            state={state}
            autoComplete="name"
          />
          <Checkbox
            name="isAnonymous"
            label={t.isAnonymous}
            announce={false}
            defaultChecked={state.values?.isAnonymous === 'on'}
          />
          <FieldRow>
            <TextField name="email" label={t.email} dict={dict} type="email" state={state} autoComplete="email" />
            <TextField name="phone" label={t.phone} dict={dict} type="tel" state={state} autoComplete="tel" />
          </FieldRow>
          <Checkbox
            name="wantsReceipt"
            label={t.wantsReceipt}
            announce={false}
            defaultChecked={state.values?.wantsReceipt === 'on'}
          />
          <TextArea name="message" label={t.message} dict={dict} rows={4} state={state} />

          {/* Last, immediately above the submit, where a consent tick belongs. */}
          <Checkbox
            name="consent"
            label={t.consent}
            error={resolveErrors(dict, state.errors, 'consent')}
            announce={false}
            required
            defaultChecked={state.values?.consent === 'on'}
          />
        </>
      )}
    </FormShell>
  );
}

/**
 * The project select, built from the kit rather than `SelectField`, because
 * `SelectField` always opens on the kit's "—" placeholder. Here the empty
 * value has a name of its own — "where it is needed most" — so it *is* the
 * placeholder: the kit's empty first option, enabled because the field is
 * optional, labelled with the dictionary's words.
 */
function SelectFieldWithEmpty({
  dict,
  label,
  emptyLabel,
  options,
  state,
}: {
  dict: FormDict;
  label: string;
  emptyLabel: string;
  options: Option[];
  state: FieldState;
}) {
  const name = 'projectId';
  const error = resolveErrors(dict, state.errors, name);
  const restored = state.values?.[name];
  return (
    <Field name={name} label={label} error={error} optionalLabel={dict.common.optional} announce={false}>
      <Select
        name={name}
        options={options}
        placeholder={emptyLabel}
        error={error}
        defaultValue={typeof restored === 'string' ? restored : ''}
      />
    </Field>
  );
}
