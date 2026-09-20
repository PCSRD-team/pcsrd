import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * `tailwind-merge` has to be told about the tokens in `globals.css`.
 *
 * Out of the box it classifies `text-*` by shape: a t-shirt size is a font
 * size, anything else is a colour. Every type token in this design system
 * — `text-small`, `text-caption`, `text-eyebrow`, `text-h2` — is "anything
 * else", so `cn('text-small text-ink')` returned `'text-ink'`: the size was
 * silently dropped as a "conflicting colour" in every component that set
 * both, which is nearly all of them. The page rendered at the browser
 * default 16px and nobody noticed, because 16px is close enough to `body`.
 *
 * The same applies to the spacing tokens (`min-h-target`) and the container
 * tokens (`max-w-narrow`): unknown to the merger, they were kept alongside
 * the class they should have replaced, and the cascade picked one at random.
 *
 * Keep this list in step with the `@theme` block. The unit test in
 * `tests/unit/ui-cn.test.ts` fails when a size token is not merged.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        'display',
        'display-ar',
        'h1',
        'h2',
        'h3',
        'h4',
        'lead',
        'body-large',
        'body',
        'small',
        'caption',
        'eyebrow',
        'label',
      ],
      spacing: ['target', 'section', 'section-sm'],
      container: ['content', 'narrow', 'prose'],
    },
  },
});

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

/**
 * The page numbers to render in a pagination control.
 *
 * Both paginations rendered one link per page with `Array.from({ length:
 * totalPages })`. That is fine against seed data and degrades badly against
 * real content: 40 pages of projects is 40 tab stops between the list and the
 * footer, and a `flex-wrap` row several lines tall on a phone. Not a WCAG
 * failure — the skip link satisfies SC 2.4.1 — but it makes the control
 * unusable exactly when there is enough content for it to matter.
 *
 * Returns first, last, and the current page with a neighbour either side, with
 * `'gap'` markers where numbers were dropped. Never returns two adjacent gaps,
 * and never a gap standing in for a single page — a `…` that hides one number
 * costs a click and saves nothing.
 *
 * Short runs are returned whole. The windowing only pays for itself once there
 * is something to save: at five pages, `1 2 … 5` replaces two numbers with an
 * ellipsis and a dead end, which is worse than the thing it is optimising. The
 * threshold is the widest window the algorithm can produce — first, last, the
 * current page with a neighbour each side, and a gap on either side — so below
 * it, eliding can never shorten the output.
 *
 * (The unit tests found this: the first version elided at five pages. It is
 * exactly the kind of edge case that looks right until something checks it.)
 */
export type PageToken = number | 'gap';

export function paginationRange(page: number, totalPages: number, radius = 1): PageToken[] {
  if (totalPages <= 1) return totalPages === 1 ? [1] : [];

  const widestWindow = 2 * radius + 5;
  if (totalPages <= widestWindow) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const wanted = new Set<number>([1, totalPages]);
  for (let n = page - radius; n <= page + radius; n += 1) {
    if (n >= 1 && n <= totalPages) wanted.add(n);
  }

  const sorted = [...wanted].sort((a, b) => a - b);
  const out: PageToken[] = [];
  let previous = 0;

  for (const n of sorted) {
    const skipped = n - previous - 1;
    if (previous > 0 && skipped > 0) {
      // One skipped page is cheaper to render than to elide.
      if (skipped === 1) out.push(previous + 1);
      else out.push('gap');
    }
    out.push(n);
    previous = n;
  }

  return out;
}
