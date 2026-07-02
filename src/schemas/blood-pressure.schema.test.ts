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

  it('rejects a negative diastolic even when systolic > diastolic holds', () => {
    expect(
      createBloodPressureSchema.safeParse({
        measuredAt: MEASURED_AT,
        systolic: 5,
        diastolic: -20,
        pulse: 70,
      }).success,
    ).toBe(false);
  });

  it('rejects a zero or negative systolic', () => {
    expect(
      createBloodPressureSchema.safeParse({
        measuredAt: MEASURED_AT,
        systolic: 0,
        diastolic: -10,
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

  it('rejects ignored: true without a reason', () => {
    expect(updateBloodPressureSchema.safeParse({ ignored: true }).success).toBe(false);
  });

  it('rejects an empty update body (Decision #33)', () => {
    expect(updateBloodPressureSchema.safeParse({}).success).toBe(false);
  });

  it('rejects unknown keys on update (Decision #32)', () => {
    expect(updateBloodPressureSchema.safeParse({ pulse: 72, createdAt: MEASURED_AT }).success).toBe(
      false,
    );
  });
});
