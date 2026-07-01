import { beforeEach, describe, expect, it } from 'vitest';
import type { JobTrackerDb } from '../db/job-tracker/client';
import { createJobApplication as createJobApplicationRow } from '../db/job-tracker/job-applications.repository';
import { freshJobTrackerDb } from '../db/job-tracker/test-helpers';
import {
  createJobApplication,
  deleteJobApplication,
  findJobApplicationById,
  getJobApplicationsMeta,
  listJobApplications,
  updateJobApplication,
} from './job-applications.service';

let db: JobTrackerDb;

beforeEach(async () => {
  db = await freshJobTrackerDb();
});

const baseInput = {
  company: 'Acme',
  position: 'Engineer',
  status: 'SAVED' as const,
  currency: 'USD',
};

describe('createJobApplication', () => {
  it('sets isDemo: true and stamps createdAt/updatedAt', async () => {
    const created = await createJobApplication(db, 'job-1', baseInput);
    expect(created.isDemo).toBe(true);
    expect(created.createdAt).toBeTruthy();
    expect(created.updatedAt).toBe(created.createdAt);
  });
});

describe('updateJobApplication', () => {
  it('bumps updatedAt without touching createdAt', async () => {
    const created = await createJobApplication(db, 'job-2', baseInput);
    // Services have no injectable clock (they call `new Date()` directly),
    // so this test relies on real wall-clock time passing between the two
    // ISO timestamps. 50ms gives a wide safety margin over the ~1ms
    // resolution of Date.toISOString() — a real D1 round-trip alone likely
    // exceeds this, but the margin is kept explicit rather than assumed.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const updated = await updateJobApplication(db, 'job-2', { notes: 'called back' });
    expect(updated?.notes).toBe('called back');
    expect(updated?.createdAt).toBe(created.createdAt);
    expect(updated?.updatedAt).not.toBe(created.createdAt);
  });

  it('returns undefined for a missing id', async () => {
    expect(await updateJobApplication(db, 'does-not-exist', { notes: 'x' })).toBeUndefined();
  });
});

describe('findJobApplicationById / deleteJobApplication', () => {
  it('finds and deletes a created record', async () => {
    await createJobApplication(db, 'job-3', baseInput);
    expect((await findJobApplicationById(db, 'job-3'))?.company).toBe('Acme');
    expect(await deleteJobApplication(db, 'job-3')).toBe(true);
    expect(await findJobApplicationById(db, 'job-3')).toBeUndefined();
  });
});

describe('listJobApplications', () => {
  it('returns pagination meta alongside rows', async () => {
    await Promise.all([
      createJobApplication(db, 'l-1', baseInput),
      createJobApplication(db, 'l-2', baseInput),
      createJobApplication(db, 'l-3', baseInput),
    ]);

    const { rows, meta } = await listJobApplications(db, { page: 1, limit: 2 });
    expect(rows).toHaveLength(2);
    expect(meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
  });
});

describe('getJobApplicationsMeta', () => {
  it('computes JobsStats rates from raw status counts', async () => {
    await Promise.all([
      createJobApplication(db, 'm-1', { ...baseInput, status: 'SCREENING' }),
      createJobApplication(db, 'm-2', { ...baseInput, status: 'TECHNICAL_INTERVIEW' }),
      createJobApplication(db, 'm-3', { ...baseInput, status: 'OFFER' }),
      createJobApplication(db, 'm-4', { ...baseInput, status: 'REJECTED' }),
    ]);

    const meta = await getJobApplicationsMeta(db);
    expect(meta.stats.total).toBe(4);
    expect(meta.stats.interviews).toBe(2);
    expect(meta.stats.interviewRate).toBe(0.5);
    expect(meta.stats.offers).toBe(1);
    expect(meta.stats.offerRate).toBe(0.25);
    expect(meta.stats.rejections).toBe(1);
    expect(meta.stats.rejectionRate).toBe(0.25);
    expect(meta.statuses.sort()).toEqual(
      ['OFFER', 'REJECTED', 'SCREENING', 'TECHNICAL_INTERVIEW'].sort(),
    );
  });

  it('returns zeroed rates instead of NaN when there are no records', async () => {
    const meta = await getJobApplicationsMeta(db);
    expect(meta.stats.total).toBe(0);
    expect(meta.stats.interviewRate).toBe(0);
    expect(meta.stats.offerRate).toBe(0);
    expect(meta.stats.rejectionRate).toBe(0);
  });

  it('scopes by isDemo when provided', async () => {
    await createJobApplication(db, 'demo-1', { ...baseInput, company: 'DemoCo' });
    // The service always sets isDemo: true on create in V1 (Decision #10) —
    // insert a "real" row directly via the repository to exercise scoping.
    await createJobApplicationRow(db, {
      id: 'real-1',
      ...baseInput,
      company: 'RealCo',
      isDemo: false,
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    });

    const demoMeta = await getJobApplicationsMeta(db, { isDemo: true });
    expect(demoMeta.companies).toEqual(['DemoCo']);

    const realMeta = await getJobApplicationsMeta(db, { isDemo: false });
    expect(realMeta.companies).toEqual(['RealCo']);
  });
});
