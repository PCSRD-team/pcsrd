/**
 * The donation vocabulary, shared by the browser and the server.
 *
 * No imports, like `lib/validation/form-options.ts`: the donation form is a
 * Client Component, and pulling these from a module that imports Zod or the
 * schema would ship both to every visitor of the donate page.
 */

/** The four currencies Bank of Palestine keeps accounts in. */
export const DONATION_CURRENCIES = ['ILS', 'USD', 'EUR', 'JOD'] as const;
export type DonationCurrency = (typeof DONATION_CURRENCIES)[number];

export const DONATION_METHODS = ['bank_transfer', 'iburaq', 'card', 'other'] as const;
export type DonationMethodValue = (typeof DONATION_METHODS)[number];

export const DONATION_STATUSES = ['pending', 'confirmed', 'rejected'] as const;

/** `PS92 PALS 0000…` as typed → `PS92PALS0000…`. */
export function normalizeIban(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Whether an IBAN is a well-formed Palestinian one **and** its check digits
 * add up (ISO 13616 mod-97).
 *
 * The check digits are why this matters: a donor copying an account number
 * by hand gets one digit wrong, and a wrong IBAN that still has the right
 * shape sends a transfer back days later, minus fees. Validating the checksum
 * when an admin saves the account is the one place that mistake can be caught
 * before it is published.
 */
export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!/^PS\d{2}[A-Z]{4}[0-9A-Z]{21}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** `PS92PALS000…` → `PS92 PALS 0000 …`, the way a bank prints it. */
export function formatIban(value: string): string {
  return normalizeIban(value).replace(/(.{4})/g, '$1 ').trim();
}
