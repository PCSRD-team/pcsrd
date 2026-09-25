'use server';

import { after } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/db';
import { _getApplicationForm, type PublicForm } from '@/db/queries/applications';
import type { ApplicationAttachment } from '@/db/schema/applications';
import type { LocaleCode } from '@/db/schema/enums';
import { type ActionErr, type ActionOk, err, ok, runAction } from '@/lib/errors';
import { getClientIp, hashIp } from '@/lib/security/ip';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { verifyTurnstile } from '@/lib/security/turnstile';
import { storagePath } from '@/lib/security/upload';
import { parseAnswers } from '@/lib/applications/answer-schema';
import { validateAttachment } from '@/lib/applications/attachments';
import {
  type FormValues,
  echoFormValues,
  formDataToObject,
} from '@/lib/validation/common';
import { submitApplication } from '@/services/applications/application.service';

/**
 * The public application endpoint.
 *
 * The same pipeline as the six fixed forms in `actions/public/forms.ts`, in the
 * same order and for the same reasons:
 *
 *     honeypot → rate limit → load the form → validate → captcha → upload → persist → notify
 *
 * What differs is that the schema is not a constant. The form's fields are read
 * from the database and compiled into a validator per request by
 * `parseAnswers`, so this action has no idea what questions it is validating —
 * which is exactly the property that makes an admin-built form as safe as a
 * hand-written one.
 *
 * Two orderings are load-bearing and easy to get backwards:
 *
 * - **The form is loaded before validation**, because there is nothing to
 *   validate against until it is. A slug that names no published form is
 *   refused here rather than at the database, so the visitor gets a sentence
 *   instead of a 500.
 *
 * - **Files are uploaded after the captcha and before the insert.** After the
 *   captcha so a bot cannot make us write to storage; before the insert so the
 *   row is never stored referring to an object that failed to upload. The
 *   reverse — insert, then upload — produces applications whose CV link 404s,
 *   and there is no way to tell them apart from applications that had no CV.
 *
 * `submitApplication` is called with **no actor**. `anon` is the correct
 * identity for a member of the public, and `app.submit_application()` is
 * SECURITY DEFINER precisely so that stays true.
 */

export type ApplyFailure = ActionErr & { values?: FormValues };
export type ApplyResult =
  | ActionOk<{ reference: string; waitlisted: boolean }>
  | ApplyFailure;

/** A honeypot hit gets a normal-looking success. Telling a bot it was caught
 *  teaches whoever wrote it what to change. */
const DECOY: ApplyResult = {
  ok: true,
  data: { reference: 'PCS-APP-000000', waitlisted: false },
};

const HONEYPOT_FIELD = 'website';

/**
 * Total bytes across every attachment on one application.
 *
 * Vercel's request body ceiling is 4.5 MB and `next.config.ts` sets the Server
 * Action limit to match, so a form asking for a CV *and* certificates *and* an
 * ID copy can exceed it even when every individual file is under the 4 MB
 * per-file cap. Checked here so the applicant reads "your files are too large
 * together" rather than losing the whole submission to an opaque 413 from the
 * platform before any of this code runs.
 */
const MAX_TOTAL_UPLOAD_BYTES = 4 * 1024 * 1024;

/** The `file` fields the form declares, in order. */
const fileFields = (form: PublicForm) =>
  form.fields.filter((field) => field.type === 'file');

/**
 * Collects and validates every attachment, then uploads them.
 *
 * Validation of **all** files happens before **any** upload. Uploading as we go
 * and failing on the fourth would leave three orphans in the bucket that
 * nothing references and nothing will ever clean up — the retention purge only
 * knows about paths recorded on a row, and a failed submission has no row.
 */
async function collectAttachments(
  form: PublicForm,
  formData: FormData,
): Promise<{ attachments: ApplicationAttachment[] } | ApplyResult> {
  const pending: { fieldKey: string; file: File; mime: string; ext: string }[] = [];
  let total = 0;

  for (const field of fileFields(form)) {
    const value = formData.get(field.key);
    const file = value instanceof File && value.size > 0 ? value : null;

    if (!file) {
      if (field.required) {
        return err('validation', 'errors.validation', {
          [field.key]: ['errors.field.required'],
        });
      }
      continue;
    }

    const validated = await validateAttachment(file, field.config.accept ?? 'document');
    if (!validated.ok) {
      return err('upload_rejected', `errors.upload.${validated.reason}`, {
        [field.key]: [`errors.upload.${validated.reason}`],
      });
    }

    total += file.size;
    if (total > MAX_TOTAL_UPLOAD_BYTES) {
      return err('upload_rejected', 'errors.upload.totalTooLarge', {
        [field.key]: ['errors.upload.totalTooLarge'],
      });
    }

    pending.push({ fieldKey: field.key, file, mime: validated.mime, ext: validated.ext });
  }

  if (pending.length === 0) return { attachments: [] };

  const { createSupabaseAdminClient } = await import('@/lib/auth/supabase-server');
  const storage = createSupabaseAdminClient().storage.from('applications');

  const attachments: ApplicationAttachment[] = [];
  for (const entry of pending) {
    const path = storagePath(`application/${entry.fieldKey}`, entry.ext);
    const { error } = await storage.upload(
      path,
      Buffer.from(await entry.file.arrayBuffer()),
      { contentType: entry.mime, upsert: false },
    );

    if (error) {
      // Roll back what did upload. Leaving them is not harmless: they are a
      // stranger's CV sitting in a bucket with nothing pointing at it and no
      // retention rule that will ever reach it.
      if (attachments.length > 0) {
        await storage.remove(attachments.map((file) => file.path)).catch(() => undefined);
      }
      return err('upload_rejected', 'errors.upload.failed', {
        [entry.fieldKey]: ['errors.upload.failed'],
      });
    }

    attachments.push({
      fieldKey: entry.fieldKey,
      path,
      // Kept for the reviewer to read. Never used as a path — the stored object
      // is a UUID, because a filename routinely carries the applicant's full
      // name and a path is effectively public information.
      originalName: entry.file.name.slice(0, 200),
      size: entry.file.size,
      mime: entry.mime,
    });
  }

  return { attachments };
}

export async function submitApplicationForm(
  _prev: ApplyResult | null,
  formData: FormData,
): Promise<ApplyResult> {
  const honeypot = formData.get(HONEYPOT_FIELD);
  if (typeof honeypot === 'string' && honeypot.length > 0) return DECOY;

  const slug = String(formData.get('formSlug') ?? '');
  const locale = (formData.get('locale') === 'en' ? 'en' : 'ar') as LocaleCode;

  const result = await runAction<{ reference: string; waitlisted: boolean }>(async () => {
    const ip = await getClientIp();

    // The `upload` limiter, not `form`: an application writes to storage, and
    // three per hour per address is the budget that limiter exists to enforce.
    const rate = await checkRateLimit('upload', hashIp(ip) ?? 'unknown');
    if (!rate.success) return err('rate_limited', 'errors.rateLimited');

    // The uncached read. `getApplicationForm` would serve an entry up to an
    // hour old, and validating a submission against a stale field list is how
    // an answer to a deleted question gets stored — or a newly required one
    // gets skipped.
    const form = await _getApplicationForm(slug, locale);
    if (!form) return err('not_found', 'errors.notFound');

    const raw = formDataToObject(
      formData,
      form.fields.filter((field) => field.type === 'multi_select').map((field) => field.key),
    );

    const answers = parseAnswers(form.fields, raw, { requireConsent: form.requireConsent });
    if (!answers.ok) {
      return err('validation', 'errors.validation', answers.fieldErrors);
    }

    const token = String(formData.get('cf-turnstile-response') ?? '');
    if (!(await verifyTurnstile(token, ip))) return err('captcha', 'errors.captcha');

    const uploaded = await collectAttachments(form, formData);
    if ('ok' in uploaded) return uploaded;

    const { extractIdentity } = await import('@/lib/applications/answer-schema');
    const identity = extractIdentity(
      form.fields.map((field) => ({
        key: field.key,
        // The public projection drops `catalogKey`; the fallback key match in
        // `extractIdentity` is what covers it, and a catalogue field's key *is*
        // its catalogue key, so nothing is lost.
        catalogKey: field.key,
        type: field.type,
      })),
      answers.answers,
    );

    const created = await submitApplication(db, {
      formId: form.id,
      locale,
      answers: answers.answers,
      attachments: uploaded.attachments,
      applicantName: identity.name,
      applicantEmail: identity.email,
      applicantPhone: identity.phone,
      ip,
      userAgent: (await headers()).get('user-agent'),
    });

    // Persist before notify, always. Email is the least reliable link in the
    // chain and a lost application is the most expensive failure this portal
    // can produce. `after()` runs once the response is on its way, so a Resend
    // outage delays nothing and loses nothing.
    after(async () => {
      const { notifyApplication } = await import('@/lib/mail/send');
      await notifyApplication({
        reference: created.reference,
        locale,
        formTitle: form.title,
        applicantName: identity.name,
        applicantEmail: identity.email,
        waitlisted: created.waitlisted,
        answers: answers.answers,
      });
    });

    return ok(
      { reference: created.reference, waitlisted: created.waitlisted },
      created.waitlisted ? 'apply.successWaitlisted' : 'forms.success',
    );
  });

  if (result.ok) return result;

  // What the visitor typed, so a no-JavaScript re-render keeps it. Files are
  // never echoed: a browser will not re-fill a file input from markup, and the
  // bytes have no business in a rendered page.
  return { ...result, values: echoFormValues(formData) };
}
