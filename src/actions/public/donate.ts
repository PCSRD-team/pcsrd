'use server';

import { after } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/db';
import { _getDonationNotifySettings } from '@/db/queries/donations';
import { validateAttachment } from '@/lib/applications/attachments';
import { type ActionErr, type ActionOk, err, ok, runAction } from '@/lib/errors';
import { getClientIp, hashIp } from '@/lib/security/ip';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { verifyTurnstile } from '@/lib/security/turnstile';
import { storagePath } from '@/lib/security/upload';
import {
  type FormValues,
  echoFormValues,
  fieldErrorsFrom,
  formDataToObject,
} from '@/lib/validation/common';
import { donationNoticeSchema } from '@/lib/validation/donations';
import { submitDonation } from '@/services/donations/donation.service';

/**
 * The donation notice: a donor tells us they sent money.
 *
 * The same pipeline as the public forms, in the same order:
 *
 *     honeypot → rate limit → validate → captcha → upload → persist → notify
 *
 * No money passes through here. The site records the donor's claim, and a
 * person confirms it against the bank statement in the admin.
 *
 * The transfer slip is optional and goes to the private `applications` bucket
 * under `donation/`, uploaded after the captcha (a bot cannot make us write to
 * storage) and before the insert (no row ever points at a missing file). A row
 * refused after the upload removes the file again.
 */

export type DonateFailure = ActionErr & { values?: FormValues };
export type DonateResult = ActionOk<{ reference: string }> | DonateFailure;

const DECOY: DonateResult = { ok: true, data: { reference: 'PCS-DON-000000' } };
const HONEYPOT_FIELD = 'website';

async function removeUpload(path: string | null): Promise<void> {
  if (!path) return;
  try {
    const { createSupabaseAdminClient } = await import('@/lib/auth/supabase-server');
    const { error } = await createSupabaseAdminClient().storage.from('applications').remove([path]);
    if (error) throw error;
  } catch (error) {
    console.error('[donate] could not remove an orphaned slip', { error });
  }
}

export async function submitDonationNotice(
  _prev: DonateResult | null,
  formData: FormData,
): Promise<DonateResult> {
  const honeypot = formData.get(HONEYPOT_FIELD);
  if (typeof honeypot === 'string' && honeypot.length > 0) return DECOY;

  const result = await runAction<{ reference: string }>(async () => {
    const ip = await getClientIp();
    const clientKey = hashIp(ip) ?? 'unknown';

    const rate = await checkRateLimit('form', clientKey);
    if (!rate.success) return err('rate_limited', 'errors.rateLimited');
    const site = await checkRateLimit('global', clientKey);
    if (!site.success) return err('rate_limited', 'errors.rateLimited');

    const fields = formDataToObject(formData, []);
    fields.turnstileToken = formData.get('cf-turnstile-response') ?? '';
    const parsed = donationNoticeSchema.safeParse(fields);
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }
    const input = parsed.data;

    if (!(await verifyTurnstile(input.turnstileToken, ip))) return err('captcha', 'errors.captcha');

    // The slip: validated by its bytes, never by its name or claimed type.
    const slip = formData.get('attachment');
    let attachmentPath: string | null = null;
    if (slip instanceof File && slip.size > 0) {
      const validated = await validateAttachment(slip, 'scan');
      if (!validated.ok) {
        return err('upload_rejected', `errors.upload.${validated.reason}`, {
          attachment: [`errors.upload.${validated.reason}`],
        });
      }
      const { createSupabaseAdminClient } = await import('@/lib/auth/supabase-server');
      const path = storagePath('donation/slip', validated.ext);
      const { error } = await createSupabaseAdminClient()
        .storage.from('applications')
        .upload(path, Buffer.from(await slip.arrayBuffer()), {
          contentType: validated.mime,
          upsert: false,
        });
      if (error) {
        return err('upload_rejected', 'errors.upload.failed', { attachment: ['errors.upload.failed'] });
      }
      attachmentPath = path;
    }

    let created: Awaited<ReturnType<typeof submitDonation>>;
    try {
      created = await submitDonation(db, {
        locale: input.locale,
        method: input.method,
        amount: input.amount,
        currency: input.currency,
        accountId: input.accountId || null,
        transferredOn: input.transferredOn || null,
        bankReference: input.bankReference || null,
        projectId: input.projectId || null,
        donorName: input.donorName || null,
        donorEmail: input.email || null,
        donorPhone: input.phone || null,
        isAnonymous: input.isAnonymous,
        wantsReceipt: input.wantsReceipt,
        message: input.message || null,
        attachmentPath,
        ip,
        userAgent: (await headers()).get('user-agent'),
      });
    } catch (error) {
      await removeUpload(attachmentPath);
      throw error;
    }

    // Persist before notify. `after()` runs once the donor has their reference.
    after(async () => {
      const [{ notifyDonation }, settings] = await Promise.all([
        import('@/lib/mail/send'),
        _getDonationNotifySettings(input.locale),
      ]);
      await notifyDonation({
        donationId: created.id,
        reference: created.reference,
        locale: input.locale,
        amount: `${input.amount} ${input.currency}`,
        method: input.method,
        donorName: input.isAnonymous ? null : input.donorName || null,
        donorEmail: input.email || null,
        hasAttachment: attachmentPath !== null,
        thankYou: settings.thankYou,
        notifyEmails: settings.notifyEmails,
      });
    });

    return ok({ reference: created.reference }, 'donate.success');
  });

  if (result.ok) return result;
  return { ...result, values: echoFormValues(formData, []) };
}
