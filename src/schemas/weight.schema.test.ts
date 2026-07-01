import { describe, expect, it } from 'vitest';
import { createWeightSchema, updateWeightSchema } from './weight.schema';

const MEASURED_AT = '2026-07-01T08:00:00.000Z';

describe('createWeightSchema', () => {
  it('accepts a positive value', () => {
    expect(createWeightSchema.safeParse({ measuredAt: MEASURED_AT, value: 84.6 }).success).toBe(
      true,
    );
  });

  it('rejects a zero value', () => {
    expect(createWeightSchema.safeParse({ measuredAt: MEASURED_AT, value: 0 }).success).toBe(false);
  });

  it('rejects a negative value', () => {
    expect(createWeightSchema.safeParse({ measuredAt: MEASURED_AT, value: -1 }).success).toBe(
      false,
    );
  });

  it('rejects a missing value', () => {
    expect(createWeightSchema.safeParse({ measuredAt: MEASURED_AT }).success).toBe(false);
  });
});

describe('updateWeightSchema', () => {
  it('accepts an ignore-only update', () => {
    expect(updateWeightSchema.safeParse({ ignored: true, reason: 'Duplicate entry' }).success).toBe(
      true,
    );
  });

  it('rejects a non-positive value on update', () => {
    expect(updateWeightSchema.safeParse({ value: 0 }).success).toBe(false);
  });

  it('rejects ignored: true without a reason', () => {
    expect(updateWeightSchema.safeParse({ ignored: true }).success).toBe(false);
  });
});
