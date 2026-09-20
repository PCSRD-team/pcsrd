'use client';
// Client Component: `useActionState` — a rejected path needs its error on the
// input that carried it. It still submits natively before hydration.

import { useActionState, useId } from 'react';
import { type EntityResult, saveRedirectForm } from '@/actions/admin/entity-forms';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/inputs';
import { Rule } from '@/components/ui/layout';
import { Notice } from '@/components/ui/notice';
import { Heading } from '@/components/ui/typography';
import { DEFAULT_LOCALE, localePath } from '@/lib/i18n/config';
import { REDIRECT_STATUS_CODES } from '@/lib/validation/admin';
import { type AdminFormDict, resolveAdminKey } from './admin-dict';

/** Create a redirect. */
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
  const headingId = useId();

  return (
    <Panel as="section" tone="paper" padding="md" labelledBy={headingId}>
      <form action={formAction}>
        <Heading level={2} size="h4" id={headingId}>
          {t.add}
        </Heading>
        <Rule weight="mark" as="span" className="mbs-2 mbe-4" />

        {state && !state.ok ? (
          <Notice tone="danger" className="mbe-4">
            {hasFieldErrors
              ? resolveAdminKey(dict, 'admin.form.checkFields')
              : resolveAdminKey(dict, state.messageKey)}
          </Notice>
        ) : null}

        <fieldset disabled={pending} className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
          <Field name="sourcePath" label={t.source} hint={t.sourceHint} error={firstError('sourcePath')} required>
            <Input
              name="sourcePath"
              type="text"
              dir="ltr"
              required
              placeholder="/old-page"
              hint={t.sourceHint}
              error={firstError('sourcePath')}
              className="font-mono text-start"
            />
          </Field>
          <Field
            name="destinationPath"
            label={t.destination}
            hint={t.destinationHint}
            error={firstError('destinationPath')}
            required
          >
            <Input
              name="destinationPath"
              type="text"
              dir="ltr"
              required
              placeholder={localePath(DEFAULT_LOCALE, '/about')}
              hint={t.destinationHint}
              error={firstError('destinationPath')}
              className="font-mono text-start"
            />
          </Field>
          <Field name="statusCode" label={t.code} error={firstError('statusCode')} required>
            <Select
              name="statusCode"
              required
              defaultValue="308"
              placeholder={null}
              options={REDIRECT_STATUS_CODES.map((code) => ({ value: code, label: t.codes[code] }))}
              error={firstError('statusCode')}
            />
          </Field>
          <Button type="submit" loading={pending}>
            {dict.admin.form.add}
          </Button>
        </fieldset>
      </form>
    </Panel>
  );
}
