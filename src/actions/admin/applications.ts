'use server';

import { redirect } from 'next/navigation';
import { db } from '@/db';
import { requireActor } from '@/lib/auth/guard';
import { type ActionResult, err, ok, runAction } from '@/lib/errors';
import { fieldErrorsFrom } from '@/lib/validation/common';
import { applicationReviewSchema } from '@/lib/validation/applications';
import {
  deleteApplication,
  reviewApplication,
} from '@/services/applications/application.service';
import { withFlash } from './flash';

/**
 * The applicant pipeline's POST endpoints.
 *
 * No `revalidateTag` anywhere in this file, and that is deliberate rather than
 * an omission. Nothing an applicant's record affects is cached: the applicants
 * table and the applicant screen are `force-dynamic` admin pages, and the
 * public side never reads an application at all. Busting a tag here would be
 * cargo cult — and worse, it would suggest to the next reader that some public
 * page shows this data.
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

/**
 * Erasure.
 *
 * Deletes the row **and** its attachments. Removing the record while leaving
 * the CV in the bucket is the failure mode that makes an erasure request look
 * honoured when the most identifying artefact is still stored — so the storage
 * deletion is not a follow-up task, it is part of this endpoint.
 *
 * The storage call is not awaited inside the same try as the row deletion by
 * accident: the row is already gone by the time it runs, and a storage outage
 * must not roll that back or report failure to someone exercising a right. A
 * file left behind is logged and caught by the retention purge later; a row
 * left behind is a breach.
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
        await createSupabaseAdminClient().storage.from('applications').remove(attachmentPaths);
      } catch (error) {
        console.error('[applications] attachment cleanup failed', {
          applicationId: id,
          count: attachmentPaths.length,
          error,
        });
      }
    }

    return ok({ id }, 'admin.deleted');
  });

  redirect(withFlash(formId ? `/admin/careers/${formId}/applicants` : '/admin/careers', result));
}
