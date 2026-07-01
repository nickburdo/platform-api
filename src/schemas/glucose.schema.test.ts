import { describe, expect, it } from 'vitest';
import { createGlucoseSchema, updateGlucoseSchema } from './glucose.schema';

const MEASURED_AT = '2026-07-01T08:00:00.000Z';

describe('createGlucoseSchema', () => {
  it('accepts fastingValue alone', () => {
    expect(
      createGlucoseSchema.safeParse({ measuredAt: MEASURED_AT, fastingValue: 90 }).success,
    ).toBe(true);
  });

  it('accepts afterMealValue alone', () => {
    expect(
      createGlucoseSchema.safeParse({ measuredAt: MEASURED_AT, afterMealValue: 120 }).success,
    ).toBe(true);
  });

  it('rejects both fastingValue and afterMealValue present', () => {
    expect(
      createGlucoseSchema.safeParse({
        measuredAt: MEASURED_AT,
        fastingValue: 90,
        afterMealValue: 120,
      }).success,
    ).toBe(false);
  });

  it('rejects neither fastingValue nor afterMealValue present', () => {
    expect(createGlucoseSchema.safeParse({ measuredAt: MEASURED_AT }).success).toBe(false);
  });

  it('rejects a negative fastingValue', () => {
    expect(
      createGlucoseSchema.safeParse({ measuredAt: MEASURED_AT, fastingValue: -5 }).success,
    ).toBe(false);
  });

  it('rejects a zero afterMealValue', () => {
    expect(
      createGlucoseSchema.safeParse({ measuredAt: MEASURED_AT, afterMealValue: 0 }).success,
    ).toBe(false);
  });

  it('rejects a missing measuredAt', () => {
    expect(createGlucoseSchema.safeParse({ fastingValue: 90 }).success).toBe(false);
  });
});

describe('updateGlucoseSchema', () => {
  it('accepts an ignore-only update that touches no measurement fields', () => {
    expect(
      updateGlucoseSchema.safeParse({ ignored: true, reason: 'Incorrect reading' }).success,
    ).toBe(true);
  });

  it('accepts an unignore update with an empty reason', () => {
    expect(updateGlucoseSchema.safeParse({ ignored: false, reason: '' }).success).toBe(true);
  });

  it('rejects ignored: true without a reason', () => {
    expect(updateGlucoseSchema.safeParse({ ignored: true }).success).toBe(false);
  });

  it('rejects ignored: true with an empty reason', () => {
    expect(updateGlucoseSchema.safeParse({ ignored: true, reason: '' }).success).toBe(false);
  });

  it('accepts updating fastingValue alone', () => {
    expect(updateGlucoseSchema.safeParse({ fastingValue: 95 }).success).toBe(true);
  });

  it('rejects setting both fastingValue and afterMealValue in the same update', () => {
    expect(updateGlucoseSchema.safeParse({ fastingValue: 95, afterMealValue: 130 }).success).toBe(
      false,
    );
  });

  it('accepts a completely empty update', () => {
    expect(updateGlucoseSchema.safeParse({}).success).toBe(true);
  });
});
