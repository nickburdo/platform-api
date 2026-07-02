import { describe, expect, it } from 'vitest';
import { createSymptomSchema, updateSymptomSchema } from './symptom.schema';

const HAPPENED_AT = '2026-07-01T08:00:00.000Z';

describe('createSymptomSchema', () => {
  it('accepts intensity at the lower bound (1)', () => {
    expect(
      createSymptomSchema.safeParse({ happenedAt: HAPPENED_AT, type: 'headache', intensity: 1 })
        .success,
    ).toBe(true);
  });

  it('accepts intensity at the upper bound (10)', () => {
    expect(
      createSymptomSchema.safeParse({ happenedAt: HAPPENED_AT, type: 'headache', intensity: 10 })
        .success,
    ).toBe(true);
  });

  it('rejects intensity below the lower bound', () => {
    expect(
      createSymptomSchema.safeParse({ happenedAt: HAPPENED_AT, type: 'headache', intensity: 0 })
        .success,
    ).toBe(false);
  });

  it('rejects intensity above the upper bound', () => {
    expect(
      createSymptomSchema.safeParse({ happenedAt: HAPPENED_AT, type: 'headache', intensity: 11 })
        .success,
    ).toBe(false);
  });

  it('rejects a missing type', () => {
    expect(createSymptomSchema.safeParse({ happenedAt: HAPPENED_AT, intensity: 5 }).success).toBe(
      false,
    );
  });

  it('rejects server-managed fields in the body (Decision #32)', () => {
    expect(
      createSymptomSchema.safeParse({
        happenedAt: HAPPENED_AT,
        type: 'headache',
        intensity: 5,
        reason: 'x',
      }).success,
    ).toBe(false);
  });
});

describe('updateSymptomSchema', () => {
  it('accepts an ignore-only update', () => {
    expect(
      updateSymptomSchema.safeParse({ ignored: true, reason: 'Created by mistake' }).success,
    ).toBe(true);
  });

  it('rejects out-of-range intensity on update', () => {
    expect(updateSymptomSchema.safeParse({ intensity: 15 }).success).toBe(false);
  });

  it('rejects ignored: true without a reason', () => {
    expect(updateSymptomSchema.safeParse({ ignored: true }).success).toBe(false);
  });

  it('rejects an empty update body (Decision #33)', () => {
    expect(updateSymptomSchema.safeParse({}).success).toBe(false);
  });

  it('rejects unknown keys on update (Decision #32)', () => {
    expect(updateSymptomSchema.safeParse({ intensity: 5, updatedAt: HAPPENED_AT }).success).toBe(
      false,
    );
  });
});
