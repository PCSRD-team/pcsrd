import { Resend } from 'resend';
import type { SubmissionType } from '@/db/schema/enums';
import { serverEnv } from '@/lib/env';
import { publicEnv } from '@/lib/env.public';
import type { Locale } from '@/lib/i18n/config';

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
 */

let client: Resend | null = null;
const resend = () => (client ??= new Resend(serverEnv.RESEND_API_KEY));

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

const SUBJECT: Record<SubmissionType, string> = {
  partnership: 'طلب شراكة جديد',
  contact: 'رسالة جديدة من نموذج التواصل',
  volunteer: 'طلب تطوّع جديد',
  job: 'طلب توظيف جديد',
  complaint: 'شكوى جديدة عبر آلية تقديم الشكاوى',
  fraud_report: 'بلاغ انتحال صفة',
};

const ACK_SUBJECT: Record<Locale, string> = {
  ar: 'استلمنا رسالتك',
  en: 'We have received your message',
};

/** Escapes text before it enters an HTML email body. */
function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function payloadTable(payload: Record<string, unknown>): string {
  const rows = Object.entries(payload)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(
      ([key, value]) =>
        `<tr><th align="right" style="padding:6px 12px;vertical-align:top;white-space:nowrap">${escapeHtml(key)}</th>` +
        `<td style="padding:6px 12px">${escapeHtml(
          Array.isArray(value) ? value.join('، ') : value,
        )}</td></tr>`,
    )
    .join('');
  return `<table dir="rtl" style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">${rows}</table>`;
}

export type NotifyInput = {
  type: SubmissionType;
  reference: string;
  locale: Locale;
  isSensitive: boolean;
  payload: Record<string, unknown>;
};

export async function notifySubmission(input: NotifyInput): Promise<void> {
  const to = recipientFor(input.type, input.payload.enquiryType);
  const adminUrl = `${publicEnv.NEXT_PUBLIC_SITE_URL}/admin/submissions?ref=${encodeURIComponent(input.reference)}`;

  const body = input.isSensitive
    ? `<div dir="rtl" style="font-family:system-ui,sans-serif">
         <p>وردت شكوى جديدة برقم مرجعي <strong>${escapeHtml(input.reference)}</strong>.</p>
         <p>محتوى الشكوى غير مرفق في هذه الرسالة عمداً. اقرأها من لوحة التحكم:</p>
         <p><a href="${adminUrl}">${adminUrl}</a></p>
       </div>`
    : `<div dir="rtl" style="font-family:system-ui,sans-serif">
         <p>الرقم المرجعي: <strong>${escapeHtml(input.reference)}</strong></p>
         ${payloadTable(input.payload)}
         <p><a href="${adminUrl}">فتح في لوحة التحكم</a></p>
       </div>`;

  const sends: Promise<unknown>[] = [
    resend().emails.send({
      from: serverEnv.MAIL_FROM,
      to,
      subject: `${SUBJECT[input.type]} — ${input.reference}`,
      html: body,
    }),
  ];

  // Acknowledgement, only when the sender gave an address and only when the
  // submission is not confidential: a reply landing in a shared family inbox
  // can expose a complainant.
  const email = input.payload.email ?? input.payload.reporterEmail;
  if (!input.isSensitive && typeof email === 'string' && email.includes('@')) {
    sends.push(
      resend().emails.send({
        from: serverEnv.MAIL_FROM,
        to: email,
        subject: `${ACK_SUBJECT[input.locale]} — ${input.reference}`,
        html: acknowledgementBody(input.locale, input.reference),
      }),
    );
  }

  const results = await Promise.allSettled(sends);
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[mail] send failed', { reference: input.reference, error: result.reason });
    }
  }
}

function acknowledgementBody(locale: Locale, reference: string): string {
  if (locale === 'en') {
    return `<div dir="ltr" style="font-family:system-ui,sans-serif">
      <p>Thank you — we have received your message.</p>
      <p>Your reference number is <strong>${escapeHtml(reference)}</strong>. Please keep it for any follow-up.</p>
    </div>`;
  }
  return `<div dir="rtl" style="font-family:system-ui,sans-serif">
    <p>شكراً لك — وصلتنا رسالتك.</p>
    <p>رقمك المرجعي هو <strong>${escapeHtml(reference)}</strong>، احتفظ به لأي متابعة.</p>
  </div>`;
}
