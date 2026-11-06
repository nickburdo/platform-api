import { beforeEach, describe, expect, it } from 'vitest';
import type { JobTrackerDb } from './client';
import {
  createJobApplication,
  deleteJobApplication,
  deleteJobApplicationsByUserId,
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
    userId: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('createJobApplication / findJobApplicationById', () => {
  it('starts with an empty table before each test', async () => {
    const { total } = await listJobApplications(db, { page: 1, limit: 20, ownerId: null });
    expect(total).toBe(0);
  });

  it('creates a row and finds it by id', async () => {
    const created = await createJobApplication(db, makeRow({ id: 'job-1', company: 'Beacon' }));
    expect(created.company).toBe('Beacon');

    const found = await findJobApplicationById(db, 'job-1', null);
    expect(found?.company).toBe('Beacon');
  });

  it('returns undefined for a missing id', async () => {
    expect(await findJobApplicationById(db, 'does-not-exist', null)).toBeUndefined();
  });

  it('returns undefined when the id exists but outside the requested owner scope', async () => {
    await createJobApplication(db, makeRow({ id: 'job-1b', userId: 'user-a' }));
    expect(await findJobApplicationById(db, 'job-1b', null)).toBeUndefined();
    expect((await findJobApplicationById(db, 'job-1b', 'user-a'))?.id).toBe('job-1b');
  });
});

describe('updateJobApplication', () => {
  it('updates fields and returns the updated row', async () => {
    await createJobApplication(db, makeRow({ id: 'job-2', status: 'SAVED' }));
    const updated = await updateJobApplication(db, 'job-2', { status: 'APPLIED' }, null);
    expect(updated?.status).toBe('APPLIED');
  });

  it('returns undefined when updating a missing id', async () => {
    expect(
      await updateJobApplication(db, 'does-not-exist', { status: 'APPLIED' }, null),
    ).toBeUndefined();
  });

  it('returns undefined when the id exists but outside the requested owner scope', async () => {
    await createJobApplication(db, makeRow({ id: 'job-2b', userId: 'user-a' }));
    expect(await updateJobApplication(db, 'job-2b', { status: 'APPLIED' }, null)).toBeUndefined();
  });
});

describe('deleteJobApplication', () => {
  it('deletes an existing row and returns true, then false on a second delete', async () => {
    await createJobApplication(db, makeRow({ id: 'job-3' }));
    expect(await deleteJobApplication(db, 'job-3', null)).toBe(true);
    expect(await deleteJobApplication(db, 'job-3', null)).toBe(false);
    expect(await findJobApplicationById(db, 'job-3', null)).toBeUndefined();
  });

  it('does not delete a row outside the requested owner scope', async () => {
    await createJobApplication(db, makeRow({ id: 'job-3b', userId: 'user-a' }));
    expect(await deleteJobApplication(db, 'job-3b', null)).toBe(false);
    expect((await findJobApplicationById(db, 'job-3b', 'user-a'))?.id).toBe('job-3b');
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
    const { rows, total } = await listJobApplications(db, { page: 1, limit: 20, ownerId: null });
    expect(total).toBe(3);
    expect(rows).toHaveLength(3);
  });

  it('filters by exact status', async () => {
    const { rows, total } = await listJobApplications(db, {
      page: 1,
      limit: 20,
      ownerId: null,
      status: 'APPLIED',
    });
    expect(total).toBe(2);
    expect(rows.every((r) => r.status === 'APPLIED')).toBe(true);
  });

  it('filters by exact company', async () => {
    const { rows, total } = await listJobApplications(db, {
      page: 1,
      limit: 20,
      ownerId: null,
      company: 'Globex',
    });
    expect(total).toBe(1);
    expect(rows[0]?.id).toBe('l-3');
  });

  it('searches across company/position/source/notes', async () => {
    const bySource = await listJobApplications(db, {
      page: 1,
      limit: 20,
      ownerId: null,
      search: 'LinkedIn',
    });
    expect(bySource.total).toBe(1);
    expect(bySource.rows[0]?.id).toBe('l-3');

    const byNotes = await listJobApplications(db, {
      page: 1,
      limit: 20,
      ownerId: null,
      search: 'Great',
    });
    expect(byNotes.total).toBe(1);
    expect(byNotes.rows[0]?.id).toBe('l-1');
  });

  it('treats a literal underscore in the search term as literal, not a wildcard', async () => {
    await createJobApplication(db, makeRow({ id: 'l-4', company: 'co_op', status: 'SAVED' }));
    await createJobApplication(db, makeRow({ id: 'l-5', company: 'coXop', status: 'SAVED' }));

    const { rows, total } = await listJobApplications(db, {
      page: 1,
      limit: 20,
      ownerId: null,
      search: 'co_op',
    });
    expect(total).toBe(1);
    expect(rows.map((r) => r.id)).toEqual(['l-4']);
  });

  it('paginates using page and limit', async () => {
    const page1 = await listJobApplications(db, { page: 1, limit: 2, ownerId: null });
    const page2 = await listJobApplications(db, { page: 2, limit: 2, ownerId: null });
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

    const meta = await getJobApplicationsMeta(db, { ownerId: null });
    expect(meta.total).toBe(3);
    expect(meta.companies.sort()).toEqual(['Acme', 'Globex']);
    expect(meta.statusCounts.APPLIED).toBe(2);
    expect(meta.statusCounts.REJECTED).toBe(1);
  });

  it('scopes the meta to the given owner', async () => {
    await Promise.all([
      createJobApplication(db, makeRow({ id: 'm-4', company: 'Initech', userId: null })),
      createJobApplication(db, makeRow({ id: 'm-5', company: 'Umbrella', userId: 'user-a' })),
    ]);

    const demoMeta = await getJobApplicationsMeta(db, { ownerId: null });
    expect(demoMeta.companies).toEqual(['Initech']);

    const realMeta = await getJobApplicationsMeta(db, { ownerId: 'user-a' });
    expect(realMeta.companies).toEqual(['Umbrella']);
  });
});

describe('deleteJobApplicationsByUserId', () => {
  it("removes the user's rows and leaves other users' and demo rows", async () => {
    await Promise.all([
      createJobApplication(db, makeRow({ id: 'd-a1', userId: 'user-a' })),
      createJobApplication(db, makeRow({ id: 'd-a2', userId: 'user-a' })),
      createJobApplication(db, makeRow({ id: 'd-b1', userId: 'user-b' })),
      createJobApplication(db, makeRow({ id: 'd-demo', userId: null })),
    ]);

    await deleteJobApplicationsByUserId(db, 'user-a');

    expect((await listJobApplications(db, { page: 1, limit: 20, ownerId: 'user-a' })).total).toBe(
      0,
    );
    expect((await listJobApplications(db, { page: 1, limit: 20, ownerId: 'user-b' })).total).toBe(
      1,
    );
    expect((await listJobApplications(db, { page: 1, limit: 20, ownerId: null })).total).toBe(1);
  });
});
