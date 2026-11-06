import { describe, expect, it } from 'vitest';
import {
  assertReasonRequiredWhenIgnored,
  withCreateStamps,
  withUpdateStamp,
} from './health-monitor-shared';

describe('withCreateStamps', () => {
  it('adds id, userId, ignored, reason, and matching createdAt/updatedAt', () => {
    const result = withCreateStamps('id-1', { measuredAt: '2026-06-15T08:00:00.000Z' }, 'user-a');
    expect(result.id).toBe('id-1');
    expect(result.userId).toBe('user-a');
    expect(result.ignored).toBe(false);
    expect(result.reason).toBe('');
    expect(result.createdAt).toBe(result.updatedAt);
    expect(result.measuredAt).toBe('2026-06-15T08:00:00.000Z');
  });

  it('stamps a null owner (demo scope) as null', () => {
    const result = withCreateStamps('id-2', {}, null);
    expect(result.userId).toBeNull();
  });
});

describe('withUpdateStamp', () => {
  it('adds updatedAt without touching other fields', () => {
    const result = withUpdateStamp({ ignored: true, reason: 'x' });
    expect(result.ignored).toBe(true);
    expect(result.reason).toBe('x');
    expect(typeof result.updatedAt).toBe('string');
  });
});

describe('assertReasonRequiredWhenIgnored', () => {
  it('throws when ignored: true and reason is missing', () => {
    expect(() => assertReasonRequiredWhenIgnored({ ignored: true })).toThrow(
      'reason is required when ignored is true',
    );
  });

  it('throws when ignored: true and reason is an empty string', () => {
    expect(() => assertReasonRequiredWhenIgnored({ ignored: true, reason: '' })).toThrow();
  });

  it('does not throw when ignored: true and a real reason is present', () => {
    expect(() =>
      assertReasonRequiredWhenIgnored({ ignored: true, reason: 'Wrong cuff' }),
    ).not.toThrow();
  });

  it('does not throw when ignored is false/absent regardless of reason', () => {
    expect(() => assertReasonRequiredWhenIgnored({})).not.toThrow();
    expect(() => assertReasonRequiredWhenIgnored({ ignored: false })).not.toThrow();
  });
});
