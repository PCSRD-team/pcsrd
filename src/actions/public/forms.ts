'use server';

import { after } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/db';
import type { LocaleCode, SubmissionType } from '@/db/schema/enums';
import { type ActionResult, err, ok, runAction } from '@/lib/errors';
import { getClientIp } from '@/lib/security/ip';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { verifyTurnstile } from '@/lib/security/turnstile';
import { validateCvUpload, storagePath } from '@/lib/security/upload';
import { fieldErrorsFrom, formDataToObject } from '@/lib/validation/common';
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
import { createSubmission } from '@/services/submission/submission.service';
import type { z } from 'zod';

/**
 * The six public forms.
 *
 * Each is the same five steps in the same order:
 *
 *     rate limit → validate → honeypot → Turnstile → persist → notify
 *
 * **Persist before notify**, always. Email is the least reliable link in the
 * chain, and a lost partnership enquiry is the most expensive failure this site
 * can produce. `after()` runs the mail once the response is already on its way,
 * so a Resend outage delays nothing and loses nothing.
 *
 * There is no business logic here. Every `if` is about HTTP or validation; the
 * decisions about what is confidential, what gets hashed and how long anything
 * is kept live in the submission service.
 */

export type SubmissionResult = ActionResult<{ reference: string }>;

/** A honeypot hit gets a normal-looking success. Telling a bot it was caught
 *  teaches whoever wrote it what to change. */
const DECOY: SubmissionResult = { ok: true, data: { reference: 'PCS-000000' } };

type Pipeline<TSchema extends z.ZodType> = {
  schema: TSchema;
  type: SubmissionType;
  multi?: readonly string[];
  /** Extra work between validation and persistence — currently only uploads. */
  prepare?: (
    input: z.infer<TSchema>,
    formData: FormData,
  ) => Promise<{ attachmentPath?: string | null } | SubmissionResult>;
};

async function submit<TSchema extends z.ZodType>(
  formData: FormData,
  pipeline: Pipeline<TSchema>,
): Promise<SubmissionResult> {
  return runAction(async () => {
    const ip = await getClientIp();

    const limiter = pipeline.type === 'job' ? 'upload' : 'form';
    const rate = await checkRateLimit(limiter, ip);
    if (!rate.success) return err('rate_limited', 'errors.rateLimited');

    const parsed = pipeline.schema.safeParse(
      formDataToObject(formData, pipeline.multi ?? []),
    );
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }

    const input = parsed.data as z.infer<TSchema> & {
      website?: string;
      turnstileToken: string;
      locale: LocaleCode;
    };

    if (input.website) return DECOY;

    if (!(await verifyTurnstile(input.turnstileToken, ip))) {
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
 * looks it up in its own table, and zeroes the IP hash and user agent before
 * the insert. **No analytics event fires** — there is nothing to opt out of,
 * because nothing is dispatched.
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
