import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Adds months, clamping to the end of the target month.
 *
 * `new Date(2026, 0, 31)` plus one month is 2 March in plain JS arithmetic,
 * because February has no 31st. For a retention deadline that overshoot means
 * data kept days longer than policy allows, so the day is clamped instead.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

/** `YYYY-MM-DD` in UTC — the shape a Postgres `date` column expects. */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * `wa.me` link. The number is digits only with no leading `+`; anything else
 * produces a link that opens WhatsApp to an empty chat.
 */
export function buildWhatsAppUrl(number: string, message?: string): string {
  const digits = number.replace(/\D/g, '');
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Clamps a 1-based page number. */
export function clampPage(value: unknown, totalPages = Number.MAX_SAFE_INTEGER): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(1, Math.floor(n)), Math.max(1, totalPages));
}
