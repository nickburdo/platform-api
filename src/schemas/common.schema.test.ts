import { describe, expect, it } from 'vitest';
import { dateRangeQuerySchema, idParamSchema, paginationQuerySchema } from './common.schema';

describe('idParamSchema', () => {
  it('accepts a non-empty id', () => {
    expect(idParamSchema.safeParse({ id: 'job_1' }).success).toBe(true);
  });

  it('rejects an empty id', () => {
    expect(idParamSchema.safeParse({ id: '' }).success).toBe(false);
  });

  it('rejects a missing id', () => {
    expect(idParamSchema.safeParse({}).success).toBe(false);
  });
});

describe('dateRangeQuerySchema', () => {
  it('accepts both dates in YYYY-MM-DD format', () => {
    expect(
      dateRangeQuerySchema.safeParse({ date_from: '2026-06-01', date_to: '2026-06-30' }).success,
    ).toBe(true);
  });

  it('accepts neither date (both optional)', () => {
    expect(dateRangeQuerySchema.safeParse({}).success).toBe(true);
  });

  it('rejects a full ISO datetime instead of a plain date', () => {
    expect(dateRangeQuerySchema.safeParse({ date_from: '2026-06-01T00:00:00.000Z' }).success).toBe(
      false,
    );
  });

  it('rejects date_from after date_to', () => {
    expect(
      dateRangeQuerySchema.safeParse({ date_from: '2026-06-30', date_to: '2026-06-01' }).success,
    ).toBe(false);
  });

  it('accepts date_from equal to date_to', () => {
    expect(
      dateRangeQuerySchema.safeParse({ date_from: '2026-06-15', date_to: '2026-06-15' }).success,
    ).toBe(true);
  });
});

describe('paginationQuerySchema', () => {
  it('defaults page to 1 and limit to 20 when omitted', () => {
    const result = paginationQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ page: 1, limit: 20 });
    }
  });

  it('coerces string query values to numbers', () => {
    const result = paginationQuerySchema.safeParse({ page: '3', limit: '50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ page: 3, limit: 50 });
    }
  });

  it('rejects limit above 100', () => {
    expect(paginationQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('rejects page below 1', () => {
    expect(paginationQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });
});
