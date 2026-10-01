'use client';
// Client Component: `useActionState` places a rejected save's errors on the
// fields that caused them. The form still submits natively before hydration —
// everything below is a plain control inside a plain `<form>`.

import { useActionState } from 'react';
import type { DonationFormResult } from '@/actions/admin/donations';
import { SaveBar } from '@/components/admin/controls';
import { MediaPicker } from '@/components/admin/media-picker';
import { describedBy, Field, FieldRow, Fieldset } from '@/components/ui/field';
import { Checkbox, Input, Textarea } from '@/components/ui/inputs';
import { Stack } from '@/components/ui/layout';
import { Notice } from '@/components/ui/notice';
import { type AdminFormDict, resolveAdminKey } from './admin-dict';
import { adminUi } from './admin-ui-dict';
import { submitKeepingValues } from './donation-account-form';

export type DonationSettingsValues = {
  isEnabled: boolean;
  introAr: string | null;
  introEn: string | null;
  iburaqAlias: string | null;
  iburaqQrMediaId: string | null;
  cardPaymentUrl: string | null;
  thankYouAr: string | null;
  thankYouEn: string | null;
  notifyEmails: string[];
};

/**
 * The donate page's settings: open or closed, its text, and the two payment
 * methods that are not a bank account.
 *
 * Grouped by method, because each group answers one question a donor has —
 * "how do I pay with iBuraq", "how do I pay by card" — and an empty group
 * hides that method on the public page. The card URL is a link donors follow
 * to type their card number, so its hint names exactly where it comes from.
 */
export function DonationSettingsForm({
  action,
  values,
  dict,
}: {
  action: (prev: DonationFormResult | null, formData: FormData) => Promise<DonationFormResult>;
  values: DonationSettingsValues;
  dict: AdminFormDict;
}) {
  const [state, formAction, pending] = useActionState<DonationFormResult | null, FormData>(
    action,
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  // Prefix match: a bad address in the list is reported as `notifyEmails.2`.
  const error = (name: string) => {
    const keys = Object.entries(errors ?? {})
      .filter(([path]) => path === name || path.startsWith(`${name}.`))
      .flatMap(([, messages]) => messages ?? []);
    return keys.length > 0 ? [...new Set(keys)].map((key) => resolveAdminKey(dict, key)) : undefined;
  };
  const t = adminUi.donations.settings;
  const qrError = error('iburaqQrMediaId');

  return (
    <form action={formAction} onSubmit={submitKeepingValues(formAction)} noValidate>
      {state && !state.ok ? (
        <Notice tone="danger" className="mbe-6">
          {resolveAdminKey(dict, state.messageKey)}
        </Notice>
      ) : null}

      <Stack gap={10}>
        <Fieldset name="donationPage" legend={t.pageSection}>
          <Stack gap={6}>
            <Checkbox
              name="isEnabled"
              label={t.isEnabled}
              hint={t.isEnabledHint}
              defaultChecked={values.isEnabled}
            />
            <FieldRow>
              <Field name="introAr" label={t.introAr} error={error('introAr')}>
                <Textarea name="introAr" rows={4} defaultValue={values.introAr ?? ''} error={error('introAr')} />
              </Field>
              <Field name="introEn" label={t.introEn} error={error('introEn')}>
                <Textarea
                  name="introEn"
                  rows={4}
                  dir="ltr"
                  defaultValue={values.introEn ?? ''}
                  error={error('introEn')}
                />
              </Field>
            </FieldRow>
          </Stack>
        </Fieldset>

        <Fieldset name="donationIburaq" legend={t.iburaqSection}>
          <Stack gap={6}>
            <Field name="iburaqAlias" label={t.iburaqAlias} hint={t.iburaqAliasHint} error={error('iburaqAlias')}>
              <Input
                name="iburaqAlias"
                dir="ltr"
                autoComplete="off"
                defaultValue={values.iburaqAlias ?? ''}
                hint={t.iburaqAliasHint}
                error={error('iburaqAlias')}
              />
            </Field>
            <Field name="iburaqQrMediaId" label={t.iburaqQr} hint={t.iburaqQrHint} error={qrError}>
              <MediaPicker
                name="iburaqQrMediaId"
                initialValue={values.iburaqQrMediaId ?? ''}
                kind="image"
                invalid={Boolean(qrError)}
                describedBy={describedBy('iburaqQrMediaId', t.iburaqQrHint, qrError)}
              />
            </Field>
          </Stack>
        </Fieldset>

        <Fieldset name="donationCard" legend={t.cardSection}>
          <Field
            name="cardPaymentUrl"
            label={t.cardPaymentUrl}
            hint={t.cardPaymentUrlHint}
            error={error('cardPaymentUrl')}
          >
            <Input
              name="cardPaymentUrl"
              type="url"
              inputMode="url"
              placeholder="https://"
              defaultValue={values.cardPaymentUrl ?? ''}
              hint={t.cardPaymentUrlHint}
              error={error('cardPaymentUrl')}
            />
          </Field>
        </Fieldset>

        <Fieldset name="donationThankYou" legend={t.thankYouSection}>
          <FieldRow>
            <Field name="thankYouAr" label={t.thankYouAr} hint={t.thankYouHint} error={error('thankYouAr')}>
              <Textarea
                name="thankYouAr"
                rows={3}
                defaultValue={values.thankYouAr ?? ''}
                hint={t.thankYouHint}
                error={error('thankYouAr')}
              />
            </Field>
            <Field name="thankYouEn" label={t.thankYouEn} error={error('thankYouEn')}>
              <Textarea
                name="thankYouEn"
                rows={3}
                dir="ltr"
                defaultValue={values.thankYouEn ?? ''}
                error={error('thankYouEn')}
              />
            </Field>
          </FieldRow>
        </Fieldset>

        <Field
          name="notifyEmails"
          label={t.notifyEmails}
          hint={t.notifyEmailsHint}
          error={error('notifyEmails')}
        >
          <Textarea
            name="notifyEmails"
            rows={3}
            dir="ltr"
            defaultValue={values.notifyEmails.join('\n')}
            hint={t.notifyEmailsHint}
            error={error('notifyEmails')}
          />
        </Field>
      </Stack>

      <SaveBar label={t.save} pending={pending} />
    </form>
  );
}
