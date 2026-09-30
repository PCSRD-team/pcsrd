import { describe, expect, it } from 'vitest';
import { extractIdentity, parseAnswers } from '@/lib/applications/answer-schema';
import {
  displayPhoneSchema,
  normalizePhone,
  optionalPhone,
  phoneSchema,
} from '@/lib/validation/common';

/**
 * Phone numbers as Gazans type them, and the identity copied onto an
 * application row.
 */

describe('phoneSchema', () => {
  it.each([
    ['0599123456', '0599123456'],
    ['0599 123 456', '0599123456'],
    ['059-912-3456', '0599123456'],
    ['(08) 282-0000', '082820000'],
    ['+970 599 123 456', '+970599123456'],
    ['00970599123456', '00970599123456'],
    ['٠٥٩٩١٢٣٤٥٦', '0599123456'],
    ['۰۵۹۹۱۲۳۴۵۶', '0599123456'],
    ['‎+970599123456‎', '+970599123456'],
  ])('accepts %s and stores %s', (input, stored) => {
    const parsed = phoneSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toBe(stored);
  });

  it.each(['', '12345', 'call me', '+970 599 abc', '0599123456789012345', '++970599123456'])(
    'refuses %j',
    (input) => {
      const parsed = phoneSchema.safeParse(input);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0]?.message).toBe('errors.field.phone');
    },
  );

  it('treats a blank optional phone as blank, not as an invalid number', () => {
    expect(optionalPhone.safeParse('').success).toBe(true);
    expect(optionalPhone.safeParse(undefined).success).toBe(true);
    expect(optionalPhone.safeParse('0599 123 456').data).toBe('0599123456');
  });

  it('keeps the admin’s own formatting on a published number', () => {
    expect(displayPhoneSchema.safeParse('+970 8 282 0000').data).toBe('+970 8 282 0000');
    expect(displayPhoneSchema.safeParse('not a phone').success).toBe(false);
  });

  it('normalises without judging', () => {
    expect(normalizePhone(' ٠٥٩٩-١٢٣ ٤٥٦ ')).toBe('0599123456');
  });
});

describe('a portal phone field', () => {
  const field = {
    key: 'mobile_number',
    type: 'phone' as const,
    required: true,
    options: [],
    config: {},
    visibleWhen: null,
    sensitive: false,
  };

  it('accepts a local number in Eastern-Arabic digits and stores it normalised', () => {
    const result = parseAnswers([field], { mobile_number: '٠٥٩٩ ١٢٣ ٤٥٦' });
    expect(result).toEqual({ ok: true, answers: { mobile_number: '0599123456' } });
  });
});

describe('extractIdentity', () => {
  it('takes the email only from an email-typed field', () => {
    const identity = extractIdentity(
      [
        { key: 'email', catalogKey: null, type: 'short_text' },
        { key: 'full_name_ar', catalogKey: 'full_name_ar', type: 'short_text' },
      ],
      { email: 'not an address', full_name_ar: 'سارة' },
    );
    expect(identity.email).toBeNull();
    expect(identity.name).toBe('سارة');
  });

  it('matches on the real catalogue key when the admin renamed the field', () => {
    const identity = extractIdentity(
      [{ key: 'contact_address', catalogKey: 'email', type: 'email' }],
      { contact_address: 'sara@example.ps' },
    );
    expect(identity.email).toBe('sara@example.ps');
  });

  it('re-validates the address before it becomes the acknowledgement’s recipient', () => {
    const identity = extractIdentity([{ key: 'email', catalogKey: 'email', type: 'email' }], {
      email: 'sara@',
    });
    expect(identity.email).toBeNull();
  });
});
