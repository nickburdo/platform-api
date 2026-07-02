import { describe, expect, it } from 'vitest';
import { createGlucoseSchema } from '../schemas/glucose.schema';
import { zodErrorToResponse } from './validation';

describe('zodErrorToResponse', () => {
  it('produces the documented 400 error envelope shape', () => {
    const result = createGlucoseSchema.safeParse({ measuredAt: '2026-07-01T08:00:00.000Z' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const body = zodErrorToResponse(result.error);
      expect(body.error.message).toBe('Validation error');
      expect(body.error.details).toHaveProperty('fastingValue');
      expect(Array.isArray(body.error.details.fastingValue)).toBe(true);
    }
  });

  it('buckets field errors by their first path segment', () => {
    const result = createGlucoseSchema.safeParse({ fastingValue: 90 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const body = zodErrorToResponse(result.error);
      expect(body.error.details).toHaveProperty('measuredAt');
    }
  });

  it('surfaces root-level issues (unrecognized keys, object-wide refines) under _errors', () => {
    const result = createGlucoseSchema.safeParse({
      measuredAt: '2026-07-01T08:00:00.000Z',
      fastingValue: 90,
      isDemo: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const body = zodErrorToResponse(result.error);
      expect(body.error.details).toHaveProperty('_errors');
      expect(Array.isArray(body.error.details._errors)).toBe(true);
    }
  });
});
