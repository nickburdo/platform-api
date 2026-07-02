import { describe, expect, it } from 'vitest';
import {
  createJobApplicationSchema,
  listJobApplicationsQuerySchema,
  updateJobApplicationSchema,
} from './job-applications.schema';

const NOW = '2026-07-01T12:00:00.000Z';
const LATER = '2026-07-05T12:00:00.000Z';
const EARLIER = '2026-06-25T12:00:00.000Z';

describe('createJobApplicationSchema', () => {
  it('accepts a minimal valid payload and applies defaults', () => {
    const result = createJobApplicationSchema.safeParse({ company: 'Acme', position: 'Engineer' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('SAVED');
      expect(result.data.currency).toBe('USD');
    }
  });

  it('rejects a missing company', () => {
    expect(createJobApplicationSchema.safeParse({ position: 'Engineer' }).success).toBe(false);
  });

  it('rejects a missing position', () => {
    expect(createJobApplicationSchema.safeParse({ company: 'Acme' }).success).toBe(false);
  });

  it('rejects an unknown status value', () => {
    expect(
      createJobApplicationSchema.safeParse({
        company: 'Acme',
        position: 'Engineer',
        status: 'IN_LIMBO',
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown remoteType value', () => {
    expect(
      createJobApplicationSchema.safeParse({
        company: 'Acme',
        position: 'Engineer',
        remoteType: 'FULLY_FLEXIBLE',
      }).success,
    ).toBe(false);
  });

  it('accepts salaryMin equal to salaryMax', () => {
    expect(
      createJobApplicationSchema.safeParse({
        company: 'Acme',
        position: 'Engineer',
        salaryMin: 100000,
        salaryMax: 100000,
      }).success,
    ).toBe(true);
  });

  it('rejects salaryMin greater than salaryMax', () => {
    expect(
      createJobApplicationSchema.safeParse({
        company: 'Acme',
        position: 'Engineer',
        salaryMin: 150000,
        salaryMax: 100000,
      }).success,
    ).toBe(false);
  });

  it('accepts appliedAt equal to nextFollowUpAt', () => {
    expect(
      createJobApplicationSchema.safeParse({
        company: 'Acme',
        position: 'Engineer',
        appliedAt: NOW,
        nextFollowUpAt: NOW,
      }).success,
    ).toBe(true);
  });

  it('rejects appliedAt after nextFollowUpAt', () => {
    expect(
      createJobApplicationSchema.safeParse({
        company: 'Acme',
        position: 'Engineer',
        appliedAt: LATER,
        nextFollowUpAt: EARLIER,
      }).success,
    ).toBe(false);
  });

  it('rejects server-managed fields in the body (Decision #32)', () => {
    expect(
      createJobApplicationSchema.safeParse({
        company: 'Acme',
        position: 'Engineer',
        isDemo: false,
      }).success,
    ).toBe(false);
  });

  it('rejects unknown keys such as field-name typos (Decision #32)', () => {
    expect(
      createJobApplicationSchema.safeParse({
        company: 'Acme',
        position: 'Engineer',
        salaryMni: 100000,
      }).success,
    ).toBe(false);
  });
});

describe('updateJobApplicationSchema', () => {
  it('accepts a partial update touching only one field', () => {
    expect(updateJobApplicationSchema.safeParse({ status: 'APPLIED' }).success).toBe(true);
  });

  it('rejects an empty update body (Decision #33)', () => {
    expect(updateJobApplicationSchema.safeParse({}).success).toBe(false);
  });

  it('rejects server-managed fields on update (Decision #32)', () => {
    expect(updateJobApplicationSchema.safeParse({ id: 'job_1', notes: 'hi' }).success).toBe(false);
  });

  it('still enforces salary ordering when both are provided', () => {
    expect(
      updateJobApplicationSchema.safeParse({ salaryMin: 150000, salaryMax: 100000 }).success,
    ).toBe(false);
  });

  it('does not inject status/currency defaults when they are omitted from the patch', () => {
    const result = updateJobApplicationSchema.safeParse({ notes: 'called them back' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('status' in result.data).toBe(false);
      expect('currency' in result.data).toBe(false);
    }
  });
});

describe('listJobApplicationsQuerySchema', () => {
  it('applies pagination defaults alongside optional filters', () => {
    const result = listJobApplicationsQuerySchema.safeParse({ status: 'APPLIED' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.status).toBe('APPLIED');
    }
  });

  it('rejects an unknown status filter', () => {
    expect(listJobApplicationsQuerySchema.safeParse({ status: 'MADE_UP' }).success).toBe(false);
  });
});
