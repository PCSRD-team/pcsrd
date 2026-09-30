import { describe, expect, it } from 'vitest';
import { formatInstant } from '@/lib/format';
import { endOfSiteDay, siteToday, zoneOffset } from '@/lib/time-zone';

/**
 * Deadlines are Palestine dates and form windows are instants shown on the
 * Palestine clock. Neither may depend on the zone of the machine rendering
 * them — UTC on Vercel.
 */
describe('siteToday', () => {
  it('is already tomorrow in Gaza while UTC is still on the previous day', () => {
    // 22:30 UTC on 1 Aug is 01:30 on 2 Aug in Gaza (UTC+3 in summer).
    expect(siteToday(new Date('2030-08-01T22:30:00Z'))).toBe('2030-08-02');
  });

  it('matches the UTC date in the middle of the day', () => {
    expect(siteToday(new Date('2030-01-15T12:00:00Z'))).toBe('2030-01-15');
  });
});

describe('endOfSiteDay / zoneOffset', () => {
  it('carries the summer offset', () => {
    expect(endOfSiteDay('2030-08-01')).toBe('2030-08-01T23:59:59+03:00');
  });

  it('carries the winter offset', () => {
    expect(endOfSiteDay('2030-01-15')).toBe('2030-01-15T23:59:59+02:00');
    expect(zoneOffset(new Date('2030-01-15T12:00:00Z'))).toBe('+02:00');
  });
});

describe('formatInstant', () => {
  it('shows a late-evening Gaza deadline on its own day, with the local time', () => {
    // 20:59 UTC on 1 Aug is 23:59 on 1 Aug in Gaza.
    const text = formatInstant('2030-08-01T20:59:00Z', 'en');
    expect(text).toContain('1 August 2030');
    expect(text).toContain('23:59');
  });

  it('does not show an early-morning Gaza instant on the previous UTC day', () => {
    // 22:30 UTC on 1 Aug is 01:30 on 2 Aug in Gaza; formatDate (UTC) said 1 Aug.
    expect(formatInstant(new Date('2030-08-01T22:30:00Z'), 'en')).toContain('2 August 2030');
  });

  it('uses Western digits and the Gregorian calendar in Arabic', () => {
    expect(formatInstant('2030-08-01T20:59:00Z', 'ar')).toMatch(/2030/);
  });

  it('returns an empty string for nothing or garbage', () => {
    expect(formatInstant(null, 'ar')).toBe('');
    expect(formatInstant('not a date', 'ar')).toBe('');
  });
});
