import { describe, expect, it } from 'vitest';
import { createBloodPressureSchema, updateBloodPressureSchema } from './blood-pressure.schema';

const MEASURED_AT = '2026-07-01T08:00:00.000Z';

describe('createBloodPressureSchema', () => {
  it('accepts a valid reading', () => {
    expect(
      createBloodPressureSchema.safeParse({
        measuredAt: MEASURED_AT,
        systolic: 120,
        diastolic: 80,
        pulse: 70,
      }).success,
    ).toBe(true);
  });

  it('rejects systolic equal to diastolic', () => {
    expect(
      createBloodPressureSchema.safeParse({
        measuredAt: MEASURED_AT,
        systolic: 80,
        diastolic: 80,
        pulse: 70,
      }).success,
    ).toBe(false);
  });

  it('rejects systolic less than diastolic', () => {
    expect(
      createBloodPressureSchema.safeParse({
        measuredAt: MEASURED_AT,
        systolic: 70,
        diastolic: 90,
        pulse: 70,
      }).success,
    ).toBe(false);
  });

  it('rejects a zero pulse', () => {
    expect(
      createBloodPressureSchema.safeParse({
        measuredAt: MEASURED_AT,
        systolic: 120,
        diastolic: 80,
        pulse: 0,
      }).success,
    ).toBe(false);
  });
});

describe('updateBloodPressureSchema', () => {
  it('accepts a partial update touching only pulse', () => {
    expect(updateBloodPressureSchema.safeParse({ pulse: 72 }).success).toBe(true);
  });

  it('skips the systolic/diastolic check when only one of them is provided', () => {
    expect(updateBloodPressureSchema.safeParse({ systolic: 120 }).success).toBe(true);
  });

  it('still enforces systolic > diastolic when both are provided', () => {
    expect(updateBloodPressureSchema.safeParse({ systolic: 80, diastolic: 90 }).success).toBe(
      false,
    );
  });

  it('accepts an ignore-only update', () => {
    expect(
      updateBloodPressureSchema.safeParse({ ignored: true, reason: 'Wrong cuff' }).success,
    ).toBe(true);
  });
});
