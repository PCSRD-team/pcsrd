import { describe, expect, it } from 'vitest';
import { echoFormValues, fieldErrorsFrom, formDataToObject } from '@/lib/validation/common';
import { complaintSchema, contactSchema, partnershipSchema } from '@/lib/validation/forms';

/**
 * The form-data side of the six public forms: what the action hands to Zod,
 * what Zod hands back, and what the failed-submission response echoes to the
 * re-rendered form.
 */

function form(entries: Record<string, string | string[] | File>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) value.forEach((v) => fd.append(key, v));
    else fd.append(key, value);
  }
  return fd;
}

describe('formDataToObject', () => {
  it('collects repeated fields into arrays and forces `multi` to be arrays', () => {
    const out = formDataToObject(form({ a: '1', b: ['x', 'y'], c: 'only' }), ['c', 'd']);
    expect(out).toEqual({ a: '1', b: ['x', 'y'], c: ['only'], d: [] });
  });
});

describe('echoFormValues', () => {
  it('returns the typed strings, minus the envelope, files and Next’s own inputs', () => {
    const fd = form({
      name: 'أمل',
      interest: ['funding', 'other'],
      website: 'bot-filled',
      'cf-turnstile-response': 'token',
      locale: 'ar',
      $ACTION_ID_abc: '',
      cv: new File([new Uint8Array([1, 2, 3])], 'cv.pdf', { type: 'application/pdf' }),
    });
    expect(echoFormValues(fd, ['interest'])).toEqual({
      name: 'أمل',
      interest: ['funding', 'other'],
    });
  });

  it('keeps a single ticked box as an array when the field is `multi`', () => {
    expect(echoFormValues(form({ areas: 'media' }), ['areas'])).toEqual({ areas: ['media'] });
  });

  it('caps a runaway value', () => {
    const echoed = echoFormValues(form({ message: 'x'.repeat(20_000) }));
    expect((echoed.message as string).length).toBe(8_000);
  });
});

describe('turnstile token in the envelope', () => {
  it('is not a validation error when missing — the captcha step owns it', () => {
    const parsed = contactSchema.safeParse({
      name: 'أمل خليل',
      email: 'amal@example.org',
      phone: '',
      subject: 'سؤال عام',
      message: 'رسالة طويلة بما يكفي لتجاوز الحد الأدنى.',
      locale: 'ar',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.turnstileToken).toBe('');
  });

  it('still rejects the honeypot when it is filled', () => {
    const parsed = contactSchema.safeParse({
      name: 'أمل خليل',
      email: 'amal@example.org',
      subject: 'سؤال عام',
      message: 'رسالة طويلة بما يكفي لتجاوز الحد الأدنى.',
      website: 'http://spam',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('field errors are dictionary keys', () => {
  it('groups Zod issues by field with our keys, never Zod’s English', () => {
    const parsed = partnershipSchema.safeParse({
      organizationName: 'x',
      organizationType: 'un',
      country: 'PSE',
      contactName: 'أمل',
      role: 'مدير',
      email: 'not-an-email',
      interest: [],
      programs: [],
      message: 'قصير',
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const errors = fieldErrorsFrom(parsed.error);
    expect(errors.organizationName).toEqual(['errors.field.tooShort']);
    expect(errors.country).toEqual(['errors.field.country']);
    expect(errors.email).toEqual(['errors.field.email']);
    expect(errors.interest).toEqual(['errors.field.required']);
    expect(errors.message).toEqual(['errors.field.tooShort']);
    for (const keys of Object.values(errors)) {
      for (const key of keys) expect(key).toMatch(/^errors\./);
    }
  });

  it('accepts an anonymous complaint with every identity field blank', () => {
    const parsed = complaintSchema.safeParse({
      category: 'safeguarding',
      incidentDate: '',
      location: '',
      description: 'وصف الشكوى بما يكفي من التفاصيل ليتجاوز الحد الأدنى.',
      relatedProject: '',
      name: '',
      email: '',
      phone: '',
      contactPreference: 'none',
    });
    expect(parsed.success).toBe(true);
  });
});
