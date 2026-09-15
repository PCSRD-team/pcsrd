import type { SubmissionType } from '@/db/schema/enums';
import type { Locale } from './config';

/**
 * Copy for outbound mail — the `mail.*` namespace, in its own module.
 *
 * It is not inside `dictionaries/ar.ts` for one reason: the page dictionaries
 * are loaded through `getDictionary`, which is `server-only`, and mail is
 * rendered from `after()` and from unit tests — neither of which is a React
 * Server Component. This file has no framework imports and can be read from
 * anywhere.
 *
 * Same contract as the page dictionaries: Arabic is the source, English mirrors
 * its shape, TypeScript enforces that both stay complete, and **no
 * organisational fact lives here** (RULE 6). The organisation's name comes from
 * `organization_settings` at send time; `organizationFallback` is the generic
 * noun used only when that read fails, and it is deliberately generic.
 */

const mailAr = {
  /** Used in place of the organisation's name only when the settings row cannot be read. */
  organizationFallback: 'الجمعية',

  /** Word-list separator inside a table cell (`، ` in Arabic, `, ` in English). */
  listSeparator: '، ',

  yes: 'نعم',
  no: 'لا',

  notification: {
    subject: {
      partnership: 'طلب شراكة جديد',
      contact: 'رسالة جديدة من نموذج التواصل',
      volunteer: 'طلب تطوّع جديد',
      job: 'طلب توظيف جديد',
      complaint: 'شكوى جديدة عبر آلية تقديم الشكاوى',
      fraud_report: 'بلاغ انتحال صفة',
    } satisfies Record<SubmissionType, string>,
    preview: 'رسالة جديدة من الموقع',
    eyebrow: 'إشعار من الموقع',
    reference: 'الرقم المرجعي',
    openInAdmin: 'فتح في لوحة التحكم',
    hasAttachment: 'يتضمّن هذا الطلب ملفاً مرفقاً. يُنزَّل من لوحة التحكم فقط.',
    /** The confidential branch. Nothing but the reference and a link. */
    sensitive: {
      heading: 'وردت شكوى جديدة',
      body: 'محتوى الشكوى غير مرفق في هذه الرسالة عمداً. اقرأها من لوحة التحكم، حيث الوصول محكوم ومسجَّل.',
      doNotForward: 'لا تُعِد توجيه هذه الرسالة.',
    },
    footer: 'أُرسلت هذه الرسالة تلقائياً من موقع {organization}. لا تردّ عليها.',
  },

  acknowledgement: {
    subject: 'استلمنا رسالتك',
    preview: 'وصلتنا رسالتك، وهذا رقمك المرجعي.',
    greeting: 'شكراً لك.',
    received: 'وصلتنا رسالتك إلى {organization}.',
    referenceIntro: 'رقمك المرجعي هو',
    keepReference: 'احتفظ بهذا الرقم لأي متابعة.',
    noReply: 'أُرسلت هذه الرسالة تلقائياً. لا تردّ عليها؛ للتواصل استخدم القنوات المنشورة على الموقع.',
    footer: 'موقع {organization}',
  },
};

const mailEn: MailDict = {
  organizationFallback: 'the organisation',

  listSeparator: ', ',

  yes: 'Yes',
  no: 'No',

  notification: {
    subject: {
      partnership: 'New partnership enquiry',
      contact: 'New message from the contact form',
      volunteer: 'New volunteer application',
      job: 'New job application',
      complaint: 'New complaint through the complaints mechanism',
      fraud_report: 'Impersonation report',
    },
    preview: 'New message from the website',
    eyebrow: 'Website notification',
    reference: 'Reference',
    openInAdmin: 'Open in the admin',
    hasAttachment: 'This application includes an attached file. It can only be downloaded from the admin.',
    sensitive: {
      heading: 'A new complaint has been received',
      body: 'The content of the complaint is deliberately not included in this message. Read it in the admin, where access is controlled and logged.',
      doNotForward: 'Do not forward this message.',
    },
    footer: 'This message was sent automatically by the {organization} website. Do not reply to it.',
  },

  acknowledgement: {
    subject: 'We have received your message',
    preview: 'We have received your message. Here is your reference number.',
    greeting: 'Thank you.',
    received: 'Your message to {organization} has been received.',
    referenceIntro: 'Your reference number is',
    keepReference: 'Please keep it for any follow-up.',
    noReply: 'This message was sent automatically. Do not reply to it; to get in touch, use the channels published on the website.',
    footer: '{organization} website',
  },
};

/** The shape every locale must fill. Widened to `string`, not `as const`, for the same reason as `Dictionary`. */
export type MailDict = typeof mailAr;

export const mailDict: Record<Locale, MailDict> = { ar: mailAr, en: mailEn };

/** Fills `{organization}` in a template string. */
export function withOrganization(template: string, organization: string): string {
  return template.replaceAll('{organization}', organization);
}
