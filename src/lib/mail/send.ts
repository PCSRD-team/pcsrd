import { render, toPlainText } from '@react-email/components';
import { createElement, type ReactElement } from 'react';
import { Resend } from 'resend';
import type { SubmissionType } from '@/db/schema/enums';
import { SubmissionAcknowledgement } from '@/emails/submission-acknowledgement';
import {
  type NotificationField,
  SubmissionNotification,
} from '@/emails/submission-notification';
import { serverEnv } from '@/lib/env';
import { publicEnv } from '@/lib/env.public';
import type { Locale } from '@/lib/i18n/config';
import { ar } from '@/lib/i18n/dictionaries/ar';
import { type MailDict, mailDict } from '@/lib/i18n/mail-dict';

/**
 * Outbound mail.
 *
 * Two rules govern this module:
 *
 * 1. **A failed send never fails a submission.** Everything is wrapped in
 *    `Promise.allSettled` and called from `after()`, so the visitor already has
 *    their reference number before the first SMTP packet leaves.
 * 2. **A confidential complaint's content never enters an inbox.** The
 *    notification carries the reference and a link into the admin, nothing
 *    else. Mail is forwarded, archived and searched; the admin is access
 *    controlled and audited. Putting the complaint in the email would undo
 *    every protection the rest of the system provides.
 *
 * Rule 2 is enforced twice: here, where a sensitive submission's payload is
 * never turned into fields, and in the template's props, which have no
 * `fields` slot when `sensitive` is true. Copy comes from
 * `src/lib/i18n/mail-dict.ts`; the organisation's name comes from
 * `organization_settings` at send time and never from a literal.
 *
 * This module imports nothing from `next/*`. It runs inside `after()`, but it
 * does not know that, which is what lets a unit test render every template.
 */

let client: Resend | null = null;
const resend = () => (client ??= new Resend(serverEnv.RESEND_API_KEY));

/**
 * Staff notifications are written in the admin's language. The visitor's
 * locale governs only the acknowledgement they receive.
 */
const STAFF_LOCALE: Locale = 'ar';

/** Which inbox each form type reaches. */
function recipientFor(type: SubmissionType, enquiryType?: unknown): string {
  switch (type) {
    case 'partnership':
      return serverEnv.MAIL_TO_PARTNERSHIP;
    case 'job':
      return serverEnv.MAIL_TO_HR;
    case 'complaint':
      return serverEnv.MAIL_TO_SENSITIVE;
    case 'contact':
      return enquiryType === 'partnership'
        ? serverEnv.MAIL_TO_PARTNERSHIP
        : serverEnv.MAIL_TO_GENERAL;
    default:
      return serverEnv.MAIL_TO_GENERAL;
  }
}

/**
 * Payload keys the notification never prints. `locale` is transport; the
 * others are the envelope the action already strips, listed again so a future
 * schema that forgets to cannot leak a Turnstile token into an inbox.
 */
const HIDDEN_KEYS = new Set(['locale', 'turnstileToken', 'website']);

/** Labels for payload keys and enum values, from the page dictionary. */
const FIELD_LABELS: Record<string, string> = ar.forms;
const VALUE_LABELS: Record<string, string> = {
  ...ar.formOptions,
  ...ar.enums.governorate,
  ...ar.enums.program,
  ...ar.enums.theme,
};

function labelValue(value: unknown, dict: MailDict): string {
  if (typeof value === 'boolean') return value ? dict.yes : dict.no;
  if (Array.isArray(value)) return value.map((v) => labelValue(v, dict)).join(dict.listSeparator);
  const text = String(value);
  return VALUE_LABELS[text] ?? text;
}

/**
 * Turns a payload into labelled rows. Empty values are dropped rather than
 * printed as blank cells. Keys the dictionary does not know keep their
 * identifier so the row is still readable rather than silently missing.
 */
export function payloadToFields(
  payload: Record<string, unknown>,
  dict: MailDict = mailDict[STAFF_LOCALE],
): NotificationField[] {
  return Object.entries(payload)
    .filter(
      ([key, value]) =>
        !HIDDEN_KEYS.has(key) && value !== null && value !== undefined && value !== '',
    )
    .map(([key, value]) => ({
      label: FIELD_LABELS[key] ?? key,
      value: labelValue(value, dict),
    }));
}

export type NotifyInput = {
  type: SubmissionType;
  reference: string;
  locale: Locale;
  isSensitive: boolean;
  payload: Record<string, unknown>;
  /**
   * The organisation's display name. Optional so the existing caller need
   * not change; when absent it is read from `organization_settings`, and
   * only if that read fails does the generic dictionary noun stand in.
   */
  organizationName?: string;
};

export type RenderedMail = { subject: string; html: string; text: string };

async function renderBoth(element: ReactElement): Promise<{ html: string; text: string }> {
  const html = await render(element);
  return { html, text: toPlainText(html) };
}

/**
 * Renders the staff notification. Exported so a test can assert what a
 * confidential notification does *not* contain.
 */
export async function renderNotification(input: {
  type: SubmissionType;
  reference: string;
  isSensitive: boolean;
  payload: Record<string, unknown>;
  organizationName: string;
  hasAttachment?: boolean;
}): Promise<RenderedMail> {
  const dict = mailDict[STAFF_LOCALE];
  const adminUrl = `${publicEnv.NEXT_PUBLIC_SITE_URL}/admin/submissions?ref=${encodeURIComponent(input.reference)}`;
  const base = {
    locale: STAFF_LOCALE,
    dict,
    organizationName: input.organizationName,
    type: input.type,
    reference: input.reference,
    adminUrl,
  };

  // The sensitive branch is built without ever touching `input.payload`.
  const element = input.isSensitive
    ? createElement(SubmissionNotification, { ...base, sensitive: true })
    : createElement(SubmissionNotification, {
        ...base,
        sensitive: false,
        fields: payloadToFields(input.payload, dict),
        hasAttachment: input.hasAttachment ?? false,
      });

  return {
    subject: `${dict.notification.subject[input.type]} — ${input.reference}`,
    ...(await renderBoth(element)),
  };
}

/** Renders the visitor acknowledgement in the visitor's locale. */
export async function renderAcknowledgement(input: {
  locale: Locale;
  reference: string;
  organizationName: string;
}): Promise<RenderedMail> {
  const dict = mailDict[input.locale];
  const element = createElement(SubmissionAcknowledgement, {
    locale: input.locale,
    dict,
    organizationName: input.organizationName,
    reference: input.reference,
  });
  return {
    subject: `${dict.acknowledgement.subject} — ${input.reference}`,
    ...(await renderBoth(element)),
  };
}

/**
 * The organisation's short name, from the settings row — RULE 6. Read lazily
 * so this module stays importable without a database; a failed read falls
 * back to the generic noun rather than failing the send.
 */
async function resolveOrganizationName(locale: Locale): Promise<string> {
  try {
    const { _getOrganization } = await import('@/db/queries/content');
    const org = await _getOrganization(locale);
    const name = org?.shortName?.trim();
    if (name) return name;
  } catch (error) {
    console.error('[mail] organisation name unavailable', error);
  }
  return mailDict[locale].organizationFallback;
}

export async function notifySubmission(input: NotifyInput): Promise<void> {
  const to = recipientFor(input.type, input.payload.enquiryType);

  const organizationName = input.organizationName ?? (await resolveOrganizationName(input.locale));
  const staffOrganizationName =
    input.locale === STAFF_LOCALE
      ? organizationName
      : (input.organizationName ?? (await resolveOrganizationName(STAFF_LOCALE)));

  const notification = await renderNotification({
    type: input.type,
    reference: input.reference,
    isSensitive: input.isSensitive,
    payload: input.payload,
    organizationName: staffOrganizationName,
    hasAttachment: input.type === 'job',
  });

  const sends: Promise<unknown>[] = [
    resend().emails.send({
      from: serverEnv.MAIL_FROM,
      to,
      subject: notification.subject,
      html: notification.html,
      text: notification.text,
    }),
  ];

  // Acknowledgement, only when the sender gave an address and only when the
  // submission is not confidential: a reply landing in a shared family inbox
  // can expose a complainant.
  const email = input.payload.email ?? input.payload.reporterEmail;
  if (!input.isSensitive && typeof email === 'string' && email.includes('@')) {
    const acknowledgement = await renderAcknowledgement({
      locale: input.locale,
      reference: input.reference,
      organizationName,
    });
    sends.push(
      resend().emails.send({
        from: serverEnv.MAIL_FROM,
        to: email,
        subject: acknowledgement.subject,
        html: acknowledgement.html,
        text: acknowledgement.text,
      }),
    );
  }

  const results = await Promise.allSettled(sends);
  for (const result of results) {
    if (result.status === 'rejected') {
      // The reference identifies the row; nothing from the payload is logged.
      console.error('[mail] send failed', { reference: input.reference, error: result.reason });
    }
  }
}

// ── Careers portal ───────────────────────────────────────────────────────

export type NotifyApplicationInput = {
  reference: string;
  locale: Locale;
  /** The form's title in the applicant's locale, for the acknowledgement. */
  formTitle: string;
  applicantName: string | null;
  applicantEmail: string | null;
  waitlisted: boolean;
  answers: Record<string, unknown>;
  /** Extra recipients the form's own settings name, beyond the HR inbox. */
  notifyEmails?: string[];
};

/**
 * Announces a new application and acknowledges it to the applicant.
 *
 * Reuses `SubmissionNotification` rather than adding a template. An
 * application *is* a submission as far as an inbox is concerned — a reference,
 * a set of labelled rows and a link into the admin — and a second template
 * would be the same markup maintained twice, drifting in exactly the places
 * (the footer, the reference block) where consistency is the point.
 *
 * Two differences from `notifySubmission`, both deliberate:
 *
 * - **The rows are labelled from the form, not from the page dictionary.**
 *   `FIELD_LABELS` knows the six fixed forms' keys; an admin-built form's keys
 *   are whatever the admin chose. `payloadToFields` falls back to the key,
 *   which is readable, and the full labelled answers are one click away in the
 *   admin.
 *
 * - **Sensitive answers are not in the email at all.** The notification
 *   carries the reference, the applicant's name and the form; a national ID or
 *   a date of birth stays in the database behind the audit log. Mail is
 *   forwarded, archived and searched — the same reasoning as rule 2 above,
 *   applied to recruitment data rather than to a complaint.
 */
export async function notifyApplication(input: NotifyApplicationInput): Promise<void> {
  const recipients = [serverEnv.MAIL_TO_HR, ...(input.notifyEmails ?? [])];
  const organizationName = await resolveOrganizationName(STAFF_LOCALE);

  // Only the identity fields and the form reach the inbox. Everything else is
  // in the admin, where reading it is a permission and an audit entry.
  const summary: Record<string, unknown> = {
    form: input.formTitle,
    name: input.applicantName,
    email: input.applicantEmail,
    ...(input.waitlisted ? { waitlisted: true } : {}),
  };

  const notification = await renderNotification({
    type: 'job',
    reference: input.reference,
    isSensitive: false,
    payload: summary,
    organizationName,
    hasAttachment: true,
  });

  const sends: Promise<unknown>[] = [
    resend().emails.send({
      from: serverEnv.MAIL_FROM,
      to: [...new Set(recipients)],
      subject: notification.subject,
      html: notification.html,
      text: notification.text,
    }),
  ];

  if (input.applicantEmail?.includes('@')) {
    const acknowledgement = await renderAcknowledgement({
      locale: input.locale,
      reference: input.reference,
      organizationName: await resolveOrganizationName(input.locale),
    });
    sends.push(
      resend().emails.send({
        from: serverEnv.MAIL_FROM,
        to: input.applicantEmail,
        subject: acknowledgement.subject,
        html: acknowledgement.html,
        text: acknowledgement.text,
      }),
    );
  }

  for (const result of await Promise.allSettled(sends)) {
    if (result.status === 'rejected') {
      // The reference identifies the row; no answer is logged.
      console.error('[mail] application send failed', {
        reference: input.reference,
        error: result.reason,
      });
    }
  }
}
