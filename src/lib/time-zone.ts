/**
 * The site's wall clock, for the few inputs that take a time of day.
 *
 * A `datetime-local` input posts `2026-10-01T23:59` with no zone at all, and
 * `new Date()` reads that in the zone of whatever process parses it — UTC on
 * Vercel. An admin in Gaza typing "23:59" therefore set a deadline of 23:59
 * UTC, which is 01:59 or 02:59 the next morning where the applicants are. The
 * two functions below read and write those inputs in the organisation's zone
 * instead, and because they do not depend on the machine's zone, the server
 * render and the browser render of an editor agree.
 *
 * `Asia/Gaza` rather than a fixed `+02:00`: Palestine observes daylight saving,
 * and the IANA zone carries its dates.
 */
export const SITE_TIME_ZONE = 'Asia/Gaza';

/** Minutes east of UTC that `timeZone` is at the instant `date`. */
function offsetMinutes(date: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value;

  // `GMT+03:00`, `GMT-04:30`, or a bare `GMT` for UTC itself.
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? '');
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
}

/**
 * Parses an input value as a wall-clock time in `timeZone`.
 *
 * A value that already names its zone (`Z` or `+03:00`) is taken as given. A
 * bare one is placed in `timeZone`: first guessed as UTC, then shifted by the
 * zone's offset at that guess, then corrected once more in case the shift
 * crossed a daylight-saving change.
 */
export function zonedInputToDate(value: string, timeZone: string = SITE_TIME_ZONE): Date {
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return new Date(value);

  const naive = new Date(`${value.length === 16 ? `${value}:00` : value}Z`);
  if (Number.isNaN(naive.getTime())) return naive;

  const first = new Date(naive.getTime() - offsetMinutes(naive, timeZone) * 60_000);
  const second = offsetMinutes(first, timeZone);
  return new Date(naive.getTime() - second * 60_000);
}

/** Formats an instant as a `datetime-local` value (`YYYY-MM-DDTHH:mm`) in `timeZone`. */
export function dateToZonedInput(date: Date, timeZone: string = SITE_TIME_ZONE): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
