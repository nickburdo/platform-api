import { beforeEach, describe, expect, it } from 'vitest';
import type { JobTrackerDb } from './client';
import {
  createJobApplication,
  deleteJobApplication,
  findJobApplicationById,
  getJobApplicationsMeta,
  listJobApplications,
  updateJobApplication,
} from './job-applications.repository';
import type { NewJobApplication } from './schema';
import { freshJobTrackerDb } from './test-helpers';

let db: JobTrackerDb;

beforeEach(async () => {
  db = await freshJobTrackerDb();
});

function makeRow(overrides: Partial<NewJobApplication> = {}): NewJobApplication {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    company: 'Acme',
    position: 'Engineer',
    status: 'SAVED',
    currency: 'USD',
    isDemo: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('createJobApplication / findJobApplicationById', () => {
  it('starts with an empty table before each test', async () => {
    const { total } = await listJobApplications(db, { page: 1, limit: 20 });
    expect(total).toBe(0);
  });

  it('creates a row and finds it by id', async () => {
    const created = await createJobApplication(db, makeRow({ id: 'job-1', company: 'Beacon' }));
    expect(created.company).toBe('Beacon');

    const found = await findJobApplicationById(db, 'job-1', true);
    expect(found?.company).toBe('Beacon');
  });

  it('returns undefined for a missing id', async () => {
    expect(await findJobApplicationById(db, 'does-not-exist', true)).toBeUndefined();
  });

  it('returns undefined when the id exists but outside the requested isDemo scope', async () => {
    await createJobApplication(db, makeRow({ id: 'job-1b', isDemo: false }));
    expect(await findJobApplicationById(db, 'job-1b', true)).toBeUndefined();
    expect((await findJobApplicationById(db, 'job-1b', false))?.id).toBe('job-1b');
  });
});

describe('updateJobApplication', () => {
  it('updates fields and returns the updated row', async () => {
    await createJobApplication(db, makeRow({ id: 'job-2', status: 'SAVED' }));
    const updated = await updateJobApplication(db, 'job-2', { status: 'APPLIED' }, true);
    expect(updated?.status).toBe('APPLIED');
  });

  it('returns undefined when updating a missing id', async () => {
    expect(
      await updateJobApplication(db, 'does-not-exist', { status: 'APPLIED' }, true),
    ).toBeUndefined();
  });

  it('returns undefined when the id exists but outside the requested isDemo scope', async () => {
    await createJobApplication(db, makeRow({ id: 'job-2b', isDemo: false }));
    expect(
      await updateJobApplication(db, 'job-2b', { status: 'APPLIED' }, true),
    ).toBeUndefined();
  });
});

describe('deleteJobApplication', () => {
  it('deletes an existing row and returns true, then false on a second delete', async () => {
    await createJobApplication(db, makeRow({ id: 'job-3' }));
    expect(await deleteJobApplication(db, 'job-3', true)).toBe(true);
    expect(await deleteJobApplication(db, 'job-3', true)).toBe(false);
    expect(await findJobApplicationById(db, 'job-3', true)).toBeUndefined();
  });

  it('does not delete a row outside the requested isDemo scope', async () => {
    await createJobApplication(db, makeRow({ id: 'job-3b', isDemo: false }));
    expect(await deleteJobApplication(db, 'job-3b', true)).toBe(false);
    expect((await findJobApplicationById(db, 'job-3b', false))?.id).toBe('job-3b');
  });
});

describe('listJobApplications', () => {
  beforeEach(async () => {
    await Promise.all([
      createJobApplication(
        db,
        makeRow({ id: 'l-1', company: 'Acme', status: 'APPLIED', notes: 'Great fit' }),
      ),
      createJobApplication(db, makeRow({ id: 'l-2', company: 'Acme', status: 'REJECTED' })),
      createJobApplication(
        db,
        makeRow({ id: 'l-3', company: 'Globex', status: 'APPLIED', source: 'LinkedIn' }),
      ),
    ]);
  });

  it('returns all rows with the correct total when unfiltered', async () => {
    const { rows, total } = await listJobApplications(db, { page: 1, limit: 20 });
    expect(total).toBe(3);
    expect(rows).toHaveLength(3);
  });

  it('filters by exact status', async () => {
    const { rows, total } = await listJobApplications(db, {
      page: 1,
      limit: 20,
      status: 'APPLIED',
    });
    expect(total).toBe(2);
    expect(rows.every((r) => r.status === 'APPLIED')).toBe(true);
  });

  it('filters by exact company', async () => {
    const { rows, total } = await listJobApplications(db, {
      page: 1,
      limit: 20,
      company: 'Globex',
    });
    expect(total).toBe(1);
    expect(rows[0]?.id).toBe('l-3');
  });

  it('searches across company/position/source/notes', async () => {
    const bySource = await listJobApplications(db, { page: 1, limit: 20, search: 'LinkedIn' });
    expect(bySource.total).toBe(1);
    expect(bySource.rows[0]?.id).toBe('l-3');

    const byNotes = await listJobApplications(db, { page: 1, limit: 20, search: 'Great' });
    expect(byNotes.total).toBe(1);
    expect(byNotes.rows[0]?.id).toBe('l-1');
  });

  it('treats a literal underscore in the search term as literal, not a wildcard', async () => {
    await createJobApplication(db, makeRow({ id: 'l-4', company: 'co_op', status: 'SAVED' }));
    await createJobApplication(db, makeRow({ id: 'l-5', company: 'coXop', status: 'SAVED' }));

    const { rows, total } = await listJobApplications(db, {
      page: 1,
      limit: 20,
      search: 'co_op',
    });
    expect(total).toBe(1);
    expect(rows.map((r) => r.id)).toEqual(['l-4']);
  });

  it('paginates using page and limit', async () => {
    const page1 = await listJobApplications(db, { page: 1, limit: 2 });
    const page2 = await listJobApplications(db, { page: 2, limit: 2 });
    expect(page1.rows).toHaveLength(2);
    expect(page2.rows).toHaveLength(1);
    expect(page1.total).toBe(3);
    expect(page2.total).toBe(3);
  });
});

describe('getJobApplicationsMeta', () => {
  it('returns distinct companies and per-status counts', async () => {
    await Promise.all([
      createJobApplication(db, makeRow({ id: 'm-1', company: 'Acme', status: 'APPLIED' })),
      createJobApplication(db, makeRow({ id: 'm-2', company: 'Acme', status: 'APPLIED' })),
      createJobApplication(db, makeRow({ id: 'm-3', company: 'Globex', status: 'REJECTED' })),
    ]);

    const meta = await getJobApplicationsMeta(db);
    expect(meta.total).toBe(3);
    expect(meta.companies.sort()).toEqual(['Acme', 'Globex']);
    expect(meta.statusCounts.APPLIED).toBe(2);
    expect(meta.statusCounts.REJECTED).toBe(1);
  });

  it('accepts isDemo as part of an options object, consistent with the other list functions', async () => {
    await Promise.all([
      createJobApplication(db, makeRow({ id: 'm-4', company: 'Initech', isDemo: true })),
      createJobApplication(db, makeRow({ id: 'm-5', company: 'Umbrella', isDemo: false })),
    ]);

    const demoMeta = await getJobApplicationsMeta(db, { isDemo: true });
    expect(demoMeta.companies).toEqual(['Initech']);

    const realMeta = await getJobApplicationsMeta(db, { isDemo: false });
    expect(realMeta.companies).toEqual(['Umbrella']);
  });
});
