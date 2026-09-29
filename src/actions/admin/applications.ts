'use server';

import { redirect } from 'next/navigation';
import { db } from '@/db';
import { requireActor } from '@/lib/auth/guard';
import { type ActionResult, err, ok, runAction } from '@/lib/errors';
import { fieldErrorsFrom } from '@/lib/validation/common';
import { applicationReviewSchema } from '@/lib/validation/applications';
import { revalidate } from '@/lib/cache/revalidate';
import { TAGS } from '@/lib/cache/tags';
import {
  admitFromWaitlist,
  deleteApplication,
  reviewApplication,
} from '@/services/applications/application.service';
import { withFlash } from './flash';

/**
 * The applicant pipeline's POST endpoints.
 *
 * A review busts nothing: the applicants table and the applicant screen are
 * `force-dynamic`, and the public side never reads an application. Admitting
 * from the waiting list and erasing an application are different — both change
 * `submission_count`, which the public form page shows as places left — so
 * those two bust the form's tags.
 */

export type ReviewResult = ActionResult<{ id: string }>;

/**
 * Moves an applicant through the pipeline.
 *
 * The three fields travel together — status, rating, internal note — because
 * they are one decision and splitting them into three endpoints would mean
 * three round trips for what a reviewer does in one sitting. The service
 * writes the status change to `application_events` only when the status
 * actually changed, so saving a note does not manufacture a history entry.
 */
export async function reviewApplicant(
  _prev: ReviewResult | null,
  formData: FormData,
): Promise<ReviewResult> {
  const id = String(formData.get('id') ?? '');
  const returnTo = formData.get('returnTo');

  const result = await runAction<{ id: string }>(async () => {
    const actor = await requireActor();

    const parsed = applicationReviewSchema.safeParse({
      status: formData.get('status'),
      rating: formData.get('rating'),
      internalNote: formData.get('internalNote'),
    });

    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }

    const application = await reviewApplication(db, actor, id, parsed.data);
    return ok({ id: application.id }, 'admin.saved');
  });

  // Redirects rather than returning, so the no-JavaScript path lands back on
  // the applicant with a flash instead of on a bare action response.
  redirect(withFlash(returnTo ?? `/admin/careers/applicants/${id}`, result));
}

/** The form's public tags — its page shows how many places are left. */
function bustFormPage(slug: FormDataEntryValue | null) {
  const tags: string[] = [TAGS.applicationFormList];
  if (typeof slug === 'string' && slug) tags.push(TAGS.applicationForm(slug));
  revalidate(tags);
}

/** Moves a waitlisted applicant into a place. The rule lives in the service. */
export async function admitApplicant(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');

  const result = await runAction<{ id: string }>(async () => {
    const actor = await requireActor();
    await admitFromWaitlist(db, actor, id);
    bustFormPage(formData.get('slug'));
    return ok({ id }, 'admin.saved');
  });

  redirect(withFlash(`/admin/careers/applicants/${id}`, result));
}

/**
 * Erasure.
 *
 * Deletes the row **and** its attachments. Removing the record while leaving
 * the CV in the bucket is the failure mode that makes an erasure request look
 * honoured when the most identifying artefact is still stored — so the storage
 * deletion is not a follow-up task, it is part of this endpoint.
 *
 * The storage call runs after the row deletion has committed, on purpose: a
 * storage outage must not roll that back or report failure to someone
 * exercising a right. A file left behind is logged with the application id and
 * must be removed by hand — the retention purge cannot find it, because it
 * reads paths from rows and this row is gone. A row left behind is a breach.
 */
export async function deleteApplicant(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const formId = String(formData.get('formId') ?? '');

  const result = await runAction<{ id: string }>(async () => {
    const actor = await requireActor();
    const { attachmentPaths } = await deleteApplication(db, actor, id);

    if (attachmentPaths.length > 0) {
      try {
        const { createSupabaseAdminClient } = await import('@/lib/auth/supabase-server');
        const { error } = await createSupabaseAdminClient()
          .storage.from('applications')
          .remove(attachmentPaths);
        if (error) throw error;
      } catch (error) {
        console.error('[applications] attachment cleanup failed', {
          applicationId: id,
          count: attachmentPaths.length,
          error,
        });
      }
    }

    bustFormPage(formData.get('slug'));
    return ok({ id }, 'admin.deleted');
  });

  redirect(withFlash(formId ? `/admin/careers/${formId}/applicants` : '/admin/careers', result));
}
