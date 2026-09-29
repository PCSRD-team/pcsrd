import { describe, expect, it } from 'vitest';
import { dateToZonedInput, zonedInputToDate } from '@/lib/time-zone';

/**
 * The careers portal's deadlines are typed as Palestine wall-clock times and
 * must not depend on the zone of the machine that parses them — UTC on Vercel,
 * something else on a developer's laptop.
 */
describe('zonedInputToDate', () => {
  it('reads summer time as UTC+3', () => {
    expect(zonedInputToDate('2030-08-01T23:59').toISOString()).toBe('2030-08-01T20:59:00.000Z');
  });

  it('reads winter time as UTC+2', () => {
    expect(zonedInputToDate('2030-01-15T09:00').toISOString()).toBe('2030-01-15T07:00:00.000Z');
  });

  it('takes a value that names its own zone as given', () => {
    expect(zonedInputToDate('2030-01-15T09:00:00Z').toISOString()).toBe(
      '2030-01-15T09:00:00.000Z',
    );
    expect(zonedInputToDate('2030-01-15T09:00:00+05:00').toISOString()).toBe(
      '2030-01-15T04:00:00.000Z',
    );
  });
});

describe('dateToZonedInput', () => {
  it('writes the Gaza wall clock, whatever the machine zone', () => {
    expect(dateToZonedInput(new Date('2030-08-01T20:59:00Z'))).toBe('2030-08-01T23:59');
    expect(dateToZonedInput(new Date('2030-01-15T07:00:00Z'))).toBe('2030-01-15T09:00');
  });

  it('round-trips through the parser unchanged, so re-saving never drifts', () => {
    for (const value of ['2030-08-01T23:59', '2030-01-15T00:05', '2030-03-28T12:30']) {
      expect(dateToZonedInput(zonedInputToDate(value))).toBe(value);
    }
  });
});
