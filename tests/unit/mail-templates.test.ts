import { describe, expect, it } from 'vitest';
import { mailDict } from '@/lib/i18n/mail-dict';
import { payloadToFields, renderAcknowledgement, renderNotification } from '@/lib/mail/send';

/**
 * What these guarantee, in order of how much it would cost to get wrong:
 *
 * 1. A confidential complaint's content never reaches an inbox. The sensitive
 *    notification is rendered from a payload full of recognisable strings and
 *    asserted not to contain any of them — in the HTML *or* the plain-text
 *    part, since a mail client shows whichever it prefers.
 * 2. The organisation's name is never a literal in a template.
 * 3. Direction is right per locale, and Latin tokens are isolated.
 */

const ORG = 'Test Organisation Name';
const REF = 'PCS-123456';

const COMPLAINT_PAYLOAD = {
  category: 'safeguarding',
  description: 'UNIQUE-COMPLAINT-BODY-9f2c',
  location: 'UNIQUE-LOCATION-1b7e',
  name: 'UNIQUE-COMPLAINANT-NAME-55aa',
  phone: '+970599000000',
  contactPreference: 'phone',
  locale: 'ar',
};

describe('staff notification — confidential', () => {
  it('carries the reference and an admin link, and nothing from the payload', async () => {
    const mail = await renderNotification({
      type: 'complaint',
      reference: REF,
      isSensitive: true,
      payload: COMPLAINT_PAYLOAD,
      organizationName: ORG,
    });

    for (const part of [mail.html, mail.text]) {
      expect(part).toContain(REF);
      expect(part).toContain('/admin/submissions?ref=PCS-123456');
      for (const value of Object.values(COMPLAINT_PAYLOAD)) {
        if (value === 'ar') continue; // a locale code is not content
        expect(part).not.toContain(value);
      }
      // The category label from the page dictionary must not appear either —
      // it is the complaint's content, translated.
      expect(part).not.toContain('الحماية والسلامة');
    }
    expect(mail.subject).toContain(mailDict.ar.notification.subject.complaint);
    expect(mail.subject).toContain(REF);
  });

  it('is confidential for a fraud report too', async () => {
    const mail = await renderNotification({
      type: 'fraud_report',
      reference: REF,
      isSensitive: true,
      payload: { description: 'UNIQUE-FRAUD-BODY-c0de', channel: 'facebook' },
      organizationName: ORG,
    });
    expect(mail.html).not.toContain('UNIQUE-FRAUD-BODY-c0de');
    expect(mail.text).not.toContain('UNIQUE-FRAUD-BODY-c0de');
    expect(mail.html).toContain(mailDict.ar.notification.sensitive.doNotForward);
  });
});

describe('staff notification — routine', () => {
  it('renders the payload as a labelled table with the reference isolated', async () => {
    const mail = await renderNotification({
      type: 'contact',
      reference: REF,
      isSensitive: false,
      payload: {
        name: 'Test Sender',
        email: 'sender@example.org',
        enquiryType: 'partnership',
        message: 'Hello <b>there</b>',
        locale: 'en',
        turnstileToken: 'must-not-leak',
      },
      organizationName: ORG,
    });

    expect(mail.html).toContain('Test Sender');
    expect(mail.html).toContain('sender@example.org');
    // Escaped, not interpreted.
    expect(mail.html).not.toContain('<b>there</b>');
    expect(mail.html).toContain('&lt;b&gt;there&lt;/b&gt;');
    // Labelled via the page dictionary, values via the option labels.
    expect(mail.html).toContain('الاسم');
    expect(mail.html).toContain('شراكة');
    // Envelope keys never print.
    expect(mail.html).not.toContain('must-not-leak');
    expect(mail.html).not.toContain('turnstileToken');
    // Direction and isolation.
    expect(mail.html).toMatch(/<html[^>]*dir="rtl"/);
    expect(mail.html).toMatch(/<bdi[^>]*dir="ltr"[^>]*>PCS-123456<\/bdi>/);
    // The organisation's name came from the caller, not a literal.
    expect(mail.html).toContain(ORG);
    expect(mail.text).toContain(ORG);
  });

  it('flags an attachment without linking to it', async () => {
    const mail = await renderNotification({
      type: 'job',
      reference: REF,
      isSensitive: false,
      payload: { name: 'Applicant', email: 'a@example.org' },
      organizationName: ORG,
      hasAttachment: true,
    });
    expect(mail.html).toContain(mailDict.ar.notification.hasAttachment);
    expect(mail.html).not.toContain('/storage/');
    expect(mail.html).not.toContain('applications/');
  });
});

describe('payloadToFields', () => {
  it('drops empties and hidden keys, labels booleans and joins lists', () => {
    const fields = payloadToFields({
      name: 'X',
      empty: '',
      nothing: null,
      locale: 'ar',
      website: '',
      areas: ['education', 'logistics'],
      consent: true,
    });
    const byLabel = Object.fromEntries(fields.map((f) => [f.label, f.value]));
    expect(Object.keys(byLabel)).not.toContain('locale');
    expect(Object.keys(byLabel)).not.toContain('empty');
    expect(Object.keys(byLabel)).not.toContain('nothing');
    expect(byLabel['الاسم']).toBe('X');
    expect(byLabel['consent']).toBe(mailDict.ar.yes);
    expect(byLabel['مجالات التطوّع']).toContain(mailDict.ar.listSeparator);
  });
});

describe('visitor acknowledgement', () => {
  it('is Arabic and RTL for ar', async () => {
    const mail = await renderAcknowledgement({ locale: 'ar', reference: REF, organizationName: ORG });
    expect(mail.html).toMatch(/<html[^>]*lang="ar"[^>]*dir="rtl"|<html[^>]*dir="rtl"[^>]*lang="ar"/);
    expect(mail.html).toContain(mailDict.ar.acknowledgement.keepReference);
    expect(mail.html).toMatch(/<bdi[^>]*dir="ltr"[^>]*>PCS-123456<\/bdi>/);
    expect(mail.subject).toBe(`${mailDict.ar.acknowledgement.subject} — ${REF}`);
    expect(mail.html).toContain(ORG);
  });

  it('is English and LTR for en', async () => {
    const mail = await renderAcknowledgement({ locale: 'en', reference: REF, organizationName: ORG });
    expect(mail.html).toMatch(/<html[^>]*lang="en"[^>]*dir="ltr"|<html[^>]*dir="ltr"[^>]*lang="en"/);
    expect(mail.html).toContain(mailDict.en.acknowledgement.keepReference);
    expect(mail.text).toContain(REF);
    expect(mail.text).toContain(ORG);
  });

  it('never carries a literal organisation name or a placeholder', () => {
    // The dictionary names the organisation by a generic noun only.
    for (const dict of [mailDict.ar, mailDict.en]) {
      const all = JSON.stringify(dict);
      expect(all).not.toMatch(/PCSRD|Palestinian|فلسطين/i);
      expect(all).not.toContain('TODO(org)');
    }
  });
});

describe('mail dictionary', () => {
  it('has the same keys in both locales', () => {
    const keys = (o: unknown, prefix = ''): string[] =>
      typeof o === 'object' && o !== null
        ? Object.entries(o).flatMap(([k, v]) => keys(v, `${prefix}${k}.`))
        : [prefix];
    expect(keys(mailDict.en).sort()).toEqual(keys(mailDict.ar).sort());
  });
});
