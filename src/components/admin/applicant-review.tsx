'use client';
// Client Component: `useActionState` shows a rejected review's message without
// a navigation. The form still submits natively before hydration — the action
// redirects back here with a flash either way.

import { useActionState } from 'react';
import type { ReviewResult } from '@/actions/admin/applications';
import { SaveBar } from '@/components/admin/controls';
import { Field, FieldRow } from '@/components/ui/field';
import { Select, Textarea } from '@/components/ui/inputs';
import { Stack } from '@/components/ui/layout';
import { Notice } from '@/components/ui/notice';
import { applicationStatus, type ApplicationStatus } from '@/db/schema/enums';
import { type AdminFormDict, resolveAdminKey } from './admin-dict';
import { adminUi } from './admin-ui-dict';

/**
 * The reviewer's controls: status, rating, internal note.
 *
 * One form, not three. They are one decision — a reviewer reads an application
 * and records what they thought of it — and three endpoints would mean three
 * round trips for what happens in one sitting. The service writes a
 * `application_events` row only when the status actually changed, so saving a
 * note does not manufacture a history entry.
 *
 * The note is labelled as internal and says so in its hint. It is never shown
 * to the applicant, and the only thing stopping someone writing as though it
 * might be is knowing that.
 */
export function ApplicantReview({
  action,
  values,
  returnTo,
  dict,
}: {
  action: (prev: ReviewResult | null, formData: FormData) => Promise<ReviewResult>;
  values: {
    id: string;
    status: ApplicationStatus;
    rating: number | null;
    internalNote: string | null;
  };
  returnTo: string;
  dict: AdminFormDict;
}) {
  const [state, formAction, pending] = useActionState<ReviewResult | null, FormData>(
    action,
    null,
  );
  const t = adminUi.careers;

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="id" value={values.id} />
      <input type="hidden" name="returnTo" value={returnTo} />

      {state && !state.ok ? (
        <Notice tone="danger" className="mbe-6">
          {resolveAdminKey(dict, state.messageKey)}
        </Notice>
      ) : null}

      <Stack gap={6}>
        <FieldRow>
          <Field name="status" label={adminUi.list.status} required>
            <Select
              name="status"
              defaultValue={values.status}
              options={applicationStatus.enumValues.map((value) => ({
                value,
                label: t.status[value],
              }))}
            />
          </Field>
          <Field name="rating" label={t.rating}>
            <Select
              name="rating"
              defaultValue={values.rating ? String(values.rating) : ''}
              placeholder={t.noRating}
              options={[1, 2, 3, 4, 5].map((value) => ({
                value: String(value),
                label: '★'.repeat(value),
              }))}
            />
          </Field>
        </FieldRow>

        <Field name="internalNote" label={t.internalNote} hint={t.internalNoteHint}>
          <Textarea name="internalNote" rows={4} defaultValue={values.internalNote ?? ''} />
        </Field>
      </Stack>

      <SaveBar label={t.saveReview} pending={pending} />
    </form>
  );
}
