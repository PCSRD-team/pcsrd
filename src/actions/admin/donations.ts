'use server';

import { redirect } from 'next/navigation';
import { db } from '@/db';
import { requireActor } from '@/lib/auth/guard';
import { revalidate } from '@/lib/cache/revalidate';
import { TAGS } from '@/lib/cache/tags';
import { type ActionResult, err, ok, runAction } from '@/lib/errors';
import { fieldErrorsFrom } from '@/lib/validation/common';
import {
  donationAccountSchema,
  donationReviewSchema,
  donationSettingsSchema,
} from '@/lib/validation/donations';
import { parseAdminForm } from '@/lib/validation/form-data';
import {
  deleteDonation,
  deleteDonationAccount,
  reviewDonation,
  saveDonationAccount,
  updateDonationSettings,
} from '@/services/donations/donation.service';
import { withFlash } from './flash';

/**
 * The donation admin's POST endpoints.
 *
 * Guard, parse, validate, call the service, revalidate. The editors that can
 * fail on a field (an IBAN with a wrong check digit) return an `ActionResult`
 * for `useActionState`; the rest redirect with a flash key. Every one works
 * with JavaScript off.
 */

export type DonationFormResult = ActionResult<{ id: string }>;

export async function reviewDonationAction(
  _prev: DonationFormResult | null,
  formData: FormData,
): Promise<DonationFormResult> {
  const result = await runAction<{ id: string }>(async () => {
    const actor = await requireActor();
    const parsed = donationReviewSchema.safeParse(parseAdminForm(formData, {}));
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }
    const donation = await reviewDonation(db, actor, parsed.data);
    return ok({ id: donation.id }, 'admin.saved');
  });

  if (result.ok) redirect(withFlash(`/admin/donations/${result.data.id}`, result));
  return result;
}

export async function saveDonationSettingsAction(
  _prev: DonationFormResult | null,
  formData: FormData,
): Promise<DonationFormResult> {
  const result = await runAction<{ id: string }>(async () => {
    const actor = await requireActor();
    const parsed = donationSettingsSchema.safeParse(
      parseAdminForm(formData, { booleans: ['isEnabled'] }),
    );
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }
    await updateDonationSettings(db, actor, parsed.data);
    revalidate([TAGS.donationPage]);
    return ok({ id: 'settings' }, 'admin.saved');
  });

  if (result.ok) redirect(withFlash('/admin/donations/settings', result));
  return result;
}

export async function saveDonationAccountAction(
  _prev: DonationFormResult | null,
  formData: FormData,
): Promise<DonationFormResult> {
  const result = await runAction<{ id: string }>(async () => {
    const actor = await requireActor();
    const parsed = donationAccountSchema.safeParse(
      parseAdminForm(formData, { booleans: ['isActive'] }),
    );
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }
    const account = await saveDonationAccount(db, actor, parsed.data);
    revalidate([TAGS.donationPage]);
    return ok({ id: account.id }, 'admin.saved');
  });

  if (result.ok) redirect(withFlash('/admin/donations/settings', result));
  return result;
}

export async function deleteDonationAccountAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const result = await runAction<{ id: string }>(async () => {
    const actor = await requireActor();
    await deleteDonationAccount(db, actor, id);
    revalidate([TAGS.donationPage]);
    return ok({ id }, 'admin.deleted');
  });
  redirect(withFlash('/admin/donations/settings', result));
}

export async function deleteDonationAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const result = await runAction<{ id: string }>(async () => {
    const actor = await requireActor();
    const { attachmentPath } = await deleteDonation(db, actor, id);
    // The row is gone; the donor's transfer slip goes with it, or it would
    // sit in the bucket with nothing left to find it.
    if (attachmentPath) {
      try {
        const { createSupabaseAdminClient } = await import('@/lib/auth/supabase-server');
        const { error } = await createSupabaseAdminClient().storage.from('applications').remove([attachmentPath]);
        if (error) throw error;
      } catch (error) {
        console.error('[donations] slip cleanup failed', { error });
      }
    }
    return ok({ id }, 'admin.deleted');
  });
  redirect(withFlash(result.ok ? '/admin/donations' : `/admin/donations/${id}`, result));
}
