'use server';

import { after } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/db';
import type { LocaleCode, SubmissionType } from '@/db/schema/enums';
import { type ActionErr, type ActionOk, err, ok, runAction } from '@/lib/errors';
import { getClientIp, hashIp } from '@/lib/security/ip';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { verifyTurnstile } from '@/lib/security/turnstile';
import { validateCvUpload, storagePath } from '@/lib/security/upload';
import {
  type FormValues,
  echoFormValues,
  fieldErrorsFrom,
  formDataToObject,
} from '@/lib/validation/common';
import {
  PARTNERSHIP_MULTI,
  VOLUNTEER_MULTI,
  complaintSchema,
  contactSchema,
  fraudReportSchema,
  jobApplicationSchema,
  partnershipSchema,
  volunteerSchema,
} from '@/lib/validation/forms';
import { createSubmission, isSensitiveType } from '@/services/submission/submission.service';
import type { z } from 'zod';

/**
 * The six public forms.
 *
 * Each is the same pipeline in the same order:
 *
 *     honeypot → rate limit → validate (Zod) → Turnstile → upload → persist → notify
 *
 * - **Honeypot first.** It costs nothing and a bot that fills it should not
 *   spend a Redis round trip or a slot in a real visitor's shared-IP window.
 * - **Rate limit before validation** (02-API §5.1), keyed on the *hashed*
 *   address so the window key written to Upstash is opaque (audit SEC-006).
 * - **Validate before Turnstile.** The spec orders it this way and it is what
 *   keeps the no-JavaScript path honest: a visitor without the widget still
 *   gets field-level feedback, and only a form that would otherwise be
 *   accepted is turned away by the captcha — with one clear message, not a
 *   validation error on a field they cannot see.
 * - **Turnstile is rejected, not skipped, when the token is missing.** 02-API
 *   §5.1 fails closed and this file follows it; `turnstile.tsx` renders a
 *   `<noscript>` notice so the visitor learns that before they type. A missing
 *   token never falls back to "rate limit + honeypot only" — that would make
 *   "disable JavaScript" the documented way around the captcha.
 * - **Persist before notify**, always. Email is the least reliable link in the
 *   chain, and a lost partnership enquiry is the most expensive failure this
 *   site can produce. `after()` runs the mail once the response is already on
 *   its way, so a Resend outage delays nothing and loses nothing.
 *
 * There is no business logic here. Every `if` is about HTTP or validation; the
 * decisions about what is confidential, what gets hashed and how long anything
 * is kept live in the submission service. The one rule this file *reads* from
 * the service — `isSensitiveType` — is used only to keep a complainant's
 * address out of the Cloudflare request, which is a transport concern.
 *
 * On failure the result carries `values`: the submitted strings, minus the
 * envelope and any file, so the re-rendered form keeps what was typed. That
 * is the whole of the no-JavaScript retry path — the page is rendered again by
 * the server and every control's `defaultValue` comes from here.
 */

export type SubmissionFailure = ActionErr & { values?: FormValues };
export type SubmissionResult = ActionOk<{ reference: string }> | SubmissionFailure;

/** A honeypot hit gets a normal-looking success. Telling a bot it was caught
 *  teaches whoever wrote it what to change. */
const DECOY: SubmissionResult = { ok: true, data: { reference: 'PCS-000000' } };

/** The honeypot's field name. `Honeypot` in the form shell renders the same one. */
const HONEYPOT_FIELD = 'website';

type Pipeline<TSchema extends z.ZodType> = {
  schema: TSchema;
  type: SubmissionType;
  multi?: readonly string[];
  /** Extra work between the captcha and persistence — currently only uploads. */
  prepare?: (
    input: z.infer<TSchema>,
    formData: FormData,
  ) => Promise<{ attachmentPath?: string | null } | SubmissionResult>;
};

async function submit<TSchema extends z.ZodType>(
  formData: FormData,
  pipeline: Pipeline<TSchema>,
): Promise<SubmissionResult> {
  const honeypot = formData.get(HONEYPOT_FIELD);
  if (typeof honeypot === 'string' && honeypot.length > 0) return DECOY;

  const result = await runAction<{ reference: string }>(async () => {
    const ip = await getClientIp();
    const sensitive = isSensitiveType(pipeline.type);

    const limiter = pipeline.type === 'job' ? 'upload' : 'form';
    const rate = await checkRateLimit(limiter, hashIp(ip) ?? 'unknown');
    if (!rate.success) return err('rate_limited', 'errors.rateLimited');

    const fields = formDataToObject(formData, pipeline.multi ?? []);

    // Cloudflare's widget injects its hidden input as `cf-turnstile-response`.
    // The schema names the field `turnstileToken`, so without this rename every
    // one of the six forms would post a token the schema never sees.
    fields.turnstileToken = formData.get('cf-turnstile-response') ?? '';

    const parsed = pipeline.schema.safeParse(fields);
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }

    const input = parsed.data as z.infer<TSchema> & {
      website?: string;
      turnstileToken: string;
      locale: LocaleCode;
    };

    // A complainant's address goes to no third party: `remoteip` is optional
    // in Cloudflare's siteverify API and omitted for a sensitive type.
    if (!(await verifyTurnstile(input.turnstileToken, sensitive ? undefined : ip))) {
      return err('captcha', 'errors.captcha');
    }

    let attachmentPath: string | null = null;
    if (pipeline.prepare) {
      const prepared = await pipeline.prepare(parsed.data, formData);
      if ('ok' in prepared) return prepared;
      attachmentPath = prepared.attachmentPath ?? null;
    }

    // The envelope fields are transport, not content, and must not be stored.
    const { turnstileToken: _t, website: _w, ...payload } = input;
    void _t;
    void _w;

    const created = await createSubmission(db, {
      type: pipeline.type,
      locale: input.locale,
      payload: payload as Record<string, unknown>,
      attachmentPath,
      ip,
      userAgent: (await headers()).get('user-agent'),
    });

    after(async () => {
      const { notifySubmission } = await import('@/lib/mail/send');
      await notifySubmission({
        type: pipeline.type,
        reference: created.reference,
        locale: input.locale,
        isSensitive: created.isSensitive,
        payload: payload as Record<string, unknown>,
      });
    });

    return ok({ reference: created.reference }, 'forms.success');
  });

  if (result.ok) return result;
  return { ...result, values: echoFormValues(formData, pipeline.multi ?? []) };
}

export async function submitPartnership(
  _prev: SubmissionResult | null,
  formData: FormData,
): Promise<SubmissionResult> {
  return submit(formData, {
    schema: partnershipSchema,
    type: 'partnership',
    multi: PARTNERSHIP_MULTI,
  });
}

export async function submitContact(
  _prev: SubmissionResult | null,
  formData: FormData,
): Promise<SubmissionResult> {
  return submit(formData, { schema: contactSchema, type: 'contact' });
}

export async function submitVolunteer(
  _prev: SubmissionResult | null,
  formData: FormData,
): Promise<SubmissionResult> {
  return submit(formData, {
    schema: volunteerSchema,
    type: 'volunteer',
    multi: VOLUNTEER_MULTI,
  });
}

export async function submitJobApplication(
  _prev: SubmissionResult | null,
  formData: FormData,
): Promise<SubmissionResult> {
  return submit(formData, {
    schema: jobApplicationSchema,
    type: 'job',
    prepare: async (_input, form) => {
      const file = form.get('cv');
      if (!(file instanceof File) || file.size === 0) {
        return err('validation', 'errors.validation', { cv: ['errors.field.required'] });
      }

      const validated = await validateCvUpload(file);
      if (!validated.ok) {
        return err('upload_rejected', `errors.upload.${validated.reason}`, {
          cv: [`errors.upload.${validated.reason}`],
        });
      }

      const { createSupabaseAdminClient } = await import('@/lib/auth/supabase-server');
      const path = storagePath('cv', validated.ext);
      const { error } = await createSupabaseAdminClient()
        .storage.from('applications')
        .upload(path, validated.buffer, { contentType: validated.mime, upsert: false });

      if (error) {
        return err('upload_rejected', 'errors.upload.failed', {
          cv: ['errors.upload.failed'],
        });
      }
      return { attachmentPath: path };
    },
  });
}

/**
 * The complaint form.
 *
 * Identical in shape to the others, and that is the point: the confidentiality
 * rules are not restated here. `createSubmission` sees `type: 'complaint'`,
 * looks it up in its own table, zeroes the IP hash and user agent and encrypts
 * the payload before the insert — and `app.submit_form` does all three again.
 * **No analytics event fires** — there is nothing to opt out of, because
 * nothing is dispatched. `tests/integration/submission.test.ts` asserts the
 * stored row.
 */
export async function submitComplaint(
  _prev: SubmissionResult | null,
  formData: FormData,
): Promise<SubmissionResult> {
  return submit(formData, { schema: complaintSchema, type: 'complaint' });
}

export async function submitFraudReport(
  _prev: SubmissionResult | null,
  formData: FormData,
): Promise<SubmissionResult> {
  return submit(formData, { schema: fraudReportSchema, type: 'fraud_report' });
}
