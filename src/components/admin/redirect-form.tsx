'use client';

import { useActionState } from 'react';
import { type EntityResult, saveRedirectForm } from '@/actions/admin/entity-forms';
import { EnumSelect, Field, fieldDescribedBy, inputClass } from '@/components/admin/controls';
import { REDIRECT_STATUS_CODES } from '@/lib/validation/admin';
import { type AdminFormDict, resolveAdminKey } from './admin-dict';

/**
 * Create a redirect.
 *
 * A Client Component for `useActionState` — a rejected path needs its error on
 * the input that carried it — and it still submits natively before hydration.
 */
export function RedirectForm({ dict }: { dict: AdminFormDict }) {
  const [state, formAction, pending] = useActionState<EntityResult | null, FormData>(
    saveRedirectForm,
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const firstError = (field: string) => {
    const key = errors?.[field]?.[0];
    return key ? resolveAdminKey(dict, key) : undefined;
  };
  const hasFieldErrors = Boolean(errors && Object.keys(errors).some((k) => k !== '_form'));
  const t = dict.admin.redirects;

  return (
    <form action={formAction} className="rule-edge bg-paper p-5">
      <h2 className="text-small font-semibold text-ink">{t.add}</h2>
      <span className="rule-mark mbs-2 mbe-4 block" aria-hidden="true" />

      {state && !state.ok ? (
        <div className="rule-edge mbe-4 border-gold-600 bg-gold-050 p-3" role="alert">
          <p className="text-small text-ink">
            {hasFieldErrors
              ? resolveAdminKey(dict, 'admin.form.checkFields')
              : resolveAdminKey(dict, state.messageKey)}
          </p>
        </div>
      ) : null}

      <fieldset disabled={pending} className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
        <Field name="sourcePath" label={t.source} hint={t.sourceHint} error={firstError('sourcePath')} required>
          <input
            id="sourcePath"
            name="sourcePath"
            type="text"
            dir="ltr"
            required
            placeholder="/old-page"
            aria-invalid={firstError('sourcePath') ? true : undefined}
            aria-describedby={fieldDescribedBy('sourcePath', t.sourceHint, firstError('sourcePath'))}
            className={`${inputClass} font-mono`}
          />
        </Field>
        <Field
          name="destinationPath"
          label={t.destination}
          hint={t.destinationHint}
          error={firstError('destinationPath')}
          required
        >
          <input
            id="destinationPath"
            name="destinationPath"
            type="text"
            dir="ltr"
            required
            placeholder="/ar/about"
            aria-invalid={firstError('destinationPath') ? true : undefined}
            aria-describedby={fieldDescribedBy('destinationPath', t.destinationHint, firstError('destinationPath'))}
            className={`${inputClass} font-mono`}
          />
        </Field>
        <EnumSelect
          name="statusCode"
          label={t.code}
          required
          defaultValue="308"
          options={REDIRECT_STATUS_CODES.map((code) => ({ value: code, label: t.codes[code] }))}
          error={firstError('statusCode')}
        />
        <button
          type="submit"
          className="min-h-11 bg-navy-700 px-5 py-2 text-small font-medium text-paper hover:bg-navy-900"
        >
          {dict.admin.form.add}
        </button>
      </fieldset>
    </form>
  );
}
