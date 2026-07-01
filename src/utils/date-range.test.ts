import { describe, expect, it } from 'vitest';
import { toDateRangeBounds } from './date-range';

describe('toDateRangeBounds', () => {
  it('widens date_from to start-of-day', () => {
    expect(toDateRangeBounds({ date_from: '2026-06-01' }).from).toBe('2026-06-01T00:00:00.000Z');
  });

  it('widens date_to to end-of-day (inclusive of the whole day)', () => {
    expect(toDateRangeBounds({ date_to: '2026-06-30' }).to).toBe('2026-06-30T23:59:59.999Z');
  });

  it('leaves both bounds undefined when neither date is provided', () => {
    expect(toDateRangeBounds({})).toEqual({ from: undefined, to: undefined });
  });

  it('handles date_from and date_to together', () => {
    expect(toDateRangeBounds({ date_from: '2026-06-01', date_to: '2026-06-30' })).toEqual({
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-30T23:59:59.999Z',
    });
  });

  it('a record dated on date_to at 23:00 falls within the widened bound', () => {
    const { to } = toDateRangeBounds({ date_to: '2026-06-30' });
    expect('2026-06-30T23:00:00.000Z' <= (to as string)).toBe(true);
  });
});
