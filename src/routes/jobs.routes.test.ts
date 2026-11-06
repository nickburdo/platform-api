import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { freshAuthDb } from '../db/auth/test-helpers';
import { createJobTrackerDb } from '../db/job-tracker/client';
import { createJobApplication as createJobApplicationRow } from '../db/job-tracker/job-applications.repository';
import { freshJobTrackerDb } from '../db/job-tracker/test-helpers';
import {
  bearer,
  request,
  requestJson,
  seedUserAndGetToken,
  type DataEnvelope,
  type ErrorEnvelope,
  type ListEnvelope,
} from './test-helpers';

beforeEach(async () => {
  await freshJobTrackerDb();
  await freshAuthDb();
});

// Demo rows are seeded directly: guests cannot write (V4), so the API has no
// way to create them.
async function seedDemoJob(id: string, company = 'DemoCo'): Promise<void> {
  await createJobApplicationRow(createJobTrackerDb(env.JOB_TRACKER_DB), {
    id,
    company,
    position: 'Engineer',
    userId: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  });
}

async function createJob(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<Response> {
  return requestJson(
    'POST',
    '/jobs',
    { company: 'Acme', position: 'Engineer', ...overrides },
    bearer(token),
  );
}

async function createdId(res: Response): Promise<string> {
  return ((await res.json()) as DataEnvelope).data.id as string;
}

describe('POST /jobs', () => {
  it('creates a job application, stamping id and server-managed fields', async () => {
    const { token } = await seedUserAndGetToken();
    const res = await createJob(token);
    expect(res.status).toBe(201);
    const { data } = (await res.json()) as DataEnvelope;
    expect(typeof data.id).toBe('string');
    expect((data.id as string).length).toBe(36);
    expect(data.status).toBe('SAVED');
    expect(data.currency).toBe('USD');
    expect(data.createdAt).toBe(data.updatedAt);
    expect(data).not.toHaveProperty('userId');
    expect(data).not.toHaveProperty('isDemo');
  });

  it('rejects server-managed fields in the body with 400 (strict schema)', async () => {
    const { token } = await seedUserAndGetToken();
    const res = await createJob(token, { userId: 'x' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.message).toBe('Validation error');
    expect(body.error.details).toHaveProperty('_errors');
  });

  it('rejects an invalid payload with field-level details', async () => {
    const { token } = await seedUserAndGetToken();
    const res = await requestJson('POST', '/jobs', { position: 'Engineer' }, bearer(token));
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.details).toHaveProperty('company');
  });
});

describe('GET /jobs', () => {
  it('returns the paginated list envelope', async () => {
    const { token } = await seedUserAndGetToken();
    await createJob(token);
    const res = await request('/jobs', { headers: bearer(token) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as ListEnvelope;
    expect(body.data).toHaveLength(1);
    expect(body.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(body.data[0]).not.toHaveProperty('userId');
    expect(body.data[0]).not.toHaveProperty('isDemo');
  });

  it('rejects an out-of-bounds limit with 400', async () => {
    const res = await request('/jobs?limit=1000');
    expect(res.status).toBe(400);
  });
});

describe('GET /jobs/meta', () => {
  it('is routed as metadata, not as a job application id', async () => {
    const { token } = await seedUserAndGetToken();
    await createJob(token);
    const res = await request('/jobs/meta', { headers: bearer(token) });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as {
      data: { companies: string[]; statuses: string[]; stats: Record<string, number> };
    };
    expect(data.companies).toEqual(['Acme']);
    expect(data.stats.total).toBe(1);
  });
});

describe('GET /jobs/:id', () => {
  it('returns a single resource', async () => {
    const { token } = await seedUserAndGetToken();
    const id = await createdId(await createJob(token));
    const res = await request(`/jobs/${id}`, { headers: bearer(token) });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as DataEnvelope;
    expect(data.id).toBe(id);
    expect(data).not.toHaveProperty('userId');
  });

  it('returns the 404 envelope for an unknown id', async () => {
    const res = await request('/jobs/no-such-id');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { message: 'Resource not found' } });
  });
});

describe('PATCH /jobs/:id', () => {
  it('applies a partial update and bumps only what changed', async () => {
    const { token } = await seedUserAndGetToken();
    const id = await createdId(await createJob(token));
    const res = await requestJson('PATCH', `/jobs/${id}`, { status: 'APPLIED' }, bearer(token));
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as DataEnvelope;
    expect(data.status).toBe('APPLIED');
    expect(data.company).toBe('Acme');
    expect(data).not.toHaveProperty('userId');
  });

  it('rejects an empty body with 400 (Decision #33)', async () => {
    const { token } = await seedUserAndGetToken();
    const id = await createdId(await createJob(token));
    const res = await requestJson('PATCH', `/jobs/${id}`, {}, bearer(token));
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown id', async () => {
    const { token } = await seedUserAndGetToken();
    const res = await requestJson(
      'PATCH',
      '/jobs/no-such-id',
      { status: 'APPLIED' },
      bearer(token),
    );
    expect(res.status).toBe(404);
  });
});

describe('DELETE /jobs/:id', () => {
  it('deletes physically and reports success; a repeat delete is 404', async () => {
    const { token } = await seedUserAndGetToken();
    const id = await createdId(await createJob(token));

    const res = await request(`/jobs/${id}`, { method: 'DELETE', headers: bearer(token) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { success: true } });

    const repeat = await request(`/jobs/${id}`, { method: 'DELETE', headers: bearer(token) });
    expect(repeat.status).toBe(404);
  });
});

describe('guest access (V4 spec 7.2)', () => {
  it('GET /jobs returns only demo rows', async () => {
    await seedDemoJob('demo-1');
    const { token } = await seedUserAndGetToken();
    await createJob(token, { company: 'UserCo' });

    const list = (await (await request('/jobs')).json()) as ListEnvelope;
    expect(list.data.map((r) => r.company)).toEqual(['DemoCo']);
    expect(list.data[0]).not.toHaveProperty('userId');
    expect(list.data[0]).not.toHaveProperty('isDemo');

    const meta = (await (await request('/jobs/meta')).json()) as { data: { companies: string[] } };
    expect(meta.data.companies).toEqual(['DemoCo']);
  });

  it('POST with a valid body is 401 Authentication required', async () => {
    const res = await requestJson('POST', '/jobs', { company: 'Acme', position: 'Engineer' });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { message: 'Authentication required' } });
  });

  it('POST with an invalid body is 401, not 400 (guard runs before validation)', async () => {
    const res = await requestJson('POST', '/jobs', {});
    expect(res.status).toBe(401);
  });

  it('PATCH and DELETE on a demo id are 401', async () => {
    await seedDemoJob('demo-1');
    expect((await requestJson('PATCH', '/jobs/demo-1', { status: 'APPLIED' })).status).toBe(401);
    expect((await requestJson('PATCH', '/jobs/demo-1', {})).status).toBe(401);
    expect((await request('/jobs/demo-1', { method: 'DELETE' })).status).toBe(401);
  });
});

describe('user isolation', () => {
  it("a user's list contains no demo rows and meta counts only own rows", async () => {
    await seedDemoJob('demo-1');
    const { token } = await seedUserAndGetToken({ username: 'alice' });
    await createJob(token, { company: 'AliceCo' });

    const list = (await (
      await request('/jobs', { headers: bearer(token) })
    ).json()) as ListEnvelope;
    expect(list.data.map((r) => r.company)).toEqual(['AliceCo']);

    const meta = (await (await request('/jobs/meta', { headers: bearer(token) })).json()) as {
      data: { companies: string[]; stats: { total: number } };
    };
    expect(meta.data.companies).toEqual(['AliceCo']);
    expect(meta.data.stats.total).toBe(1);
  });

  it("another user cannot see, read, patch or delete a user's job (404)", async () => {
    const alice = await seedUserAndGetToken({ username: 'alice' });
    const bob = await seedUserAndGetToken({ username: 'bob' });
    const id = await createdId(await createJob(alice.token, { company: 'AliceCo' }));

    const bobList = (await (
      await request('/jobs', { headers: bearer(bob.token) })
    ).json()) as ListEnvelope;
    expect(bobList.data).toHaveLength(0);

    expect((await request(`/jobs/${id}`, { headers: bearer(bob.token) })).status).toBe(404);
    expect(
      (await requestJson('PATCH', `/jobs/${id}`, { status: 'APPLIED' }, bearer(bob.token))).status,
    ).toBe(404);
    expect(
      (await request(`/jobs/${id}`, { method: 'DELETE', headers: bearer(bob.token) })).status,
    ).toBe(404);

    // The owner still sees the untouched record.
    const own = await request(`/jobs/${id}`, { headers: bearer(alice.token) });
    expect(((await own.json()) as DataEnvelope).data.status).toBe('SAVED');
  });

  it('a user cannot read, patch or delete a demo record by id (404)', async () => {
    await seedDemoJob('demo-1');
    const { token } = await seedUserAndGetToken();

    expect((await request('/jobs/demo-1', { headers: bearer(token) })).status).toBe(404);
    expect(
      (await requestJson('PATCH', '/jobs/demo-1', { status: 'APPLIED' }, bearer(token))).status,
    ).toBe(404);
    expect(
      (await request('/jobs/demo-1', { method: 'DELETE', headers: bearer(token) })).status,
    ).toBe(404);
  });
});
