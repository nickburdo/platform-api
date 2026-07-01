import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { createJobTrackerDb, type JobTrackerDb } from '../db/job-tracker/client';
import { jobApplications } from '../db/job-tracker/schema';
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
  db = createJobTrackerDb(env.JOB_TRACKER_DB);
  await db.delete(jobApplications);
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
    await new Promise((resolve) => setTimeout(resolve, 5));
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
});
