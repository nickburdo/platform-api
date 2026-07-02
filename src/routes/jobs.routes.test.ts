import { beforeEach, describe, expect, it } from 'vitest';
import { freshJobTrackerDb } from '../db/job-tracker/test-helpers';
import {
  request,
  requestJson,
  type DataEnvelope,
  type ErrorEnvelope,
  type ListEnvelope,
} from './test-helpers';

beforeEach(async () => {
  await freshJobTrackerDb();
});

async function createJob(overrides: Record<string, unknown> = {}): Promise<Response> {
  return requestJson('POST', '/jobs', { company: 'Acme', position: 'Engineer', ...overrides });
}

describe('POST /jobs', () => {
  it('creates a job application, stamping id and server-managed fields', async () => {
    const res = await createJob();
    expect(res.status).toBe(201);
    const { data } = (await res.json()) as DataEnvelope;
    expect(typeof data.id).toBe('string');
    expect((data.id as string).length).toBe(36);
    expect(data.isDemo).toBe(true);
    expect(data.status).toBe('SAVED');
    expect(data.currency).toBe('USD');
    expect(data.createdAt).toBe(data.updatedAt);
  });

  it('rejects server-managed fields in the body with 400 (Decision #32)', async () => {
    const res = await createJob({ isDemo: false });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.message).toBe('Validation error');
    expect(body.error.details).toHaveProperty('_errors');
  });

  it('rejects an invalid payload with field-level details', async () => {
    const res = await requestJson('POST', '/jobs', { position: 'Engineer' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.details).toHaveProperty('company');
  });
});

describe('GET /jobs', () => {
  it('returns the paginated list envelope', async () => {
    await createJob();
    const res = await request('/jobs');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ListEnvelope;
    expect(body.data).toHaveLength(1);
    expect(body.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it('rejects an out-of-bounds limit with 400', async () => {
    const res = await request('/jobs?limit=1000');
    expect(res.status).toBe(400);
  });
});

describe('GET /jobs/meta', () => {
  it('is routed as metadata, not as a job application id', async () => {
    await createJob();
    const res = await request('/jobs/meta');
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
    const created = (await (await createJob()).json()) as DataEnvelope;
    const res = await request(`/jobs/${created.data.id as string}`);
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as DataEnvelope;
    expect(data.id).toBe(created.data.id);
  });

  it('returns the 404 envelope for an unknown id', async () => {
    const res = await request('/jobs/no-such-id');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { message: 'Resource not found' } });
  });
});

describe('PATCH /jobs/:id', () => {
  it('applies a partial update and bumps only what changed', async () => {
    const created = (await (await createJob()).json()) as DataEnvelope;
    const res = await requestJson('PATCH', `/jobs/${created.data.id as string}`, {
      status: 'APPLIED',
    });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as DataEnvelope;
    expect(data.status).toBe('APPLIED');
    expect(data.company).toBe('Acme');
  });

  it('rejects an empty body with 400 (Decision #33)', async () => {
    const created = (await (await createJob()).json()) as DataEnvelope;
    const res = await requestJson('PATCH', `/jobs/${created.data.id as string}`, {});
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await requestJson('PATCH', '/jobs/no-such-id', { status: 'APPLIED' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /jobs/:id', () => {
  it('deletes physically and reports success; a repeat delete is 404', async () => {
    const created = (await (await createJob()).json()) as DataEnvelope;
    const id = created.data.id as string;

    const res = await request(`/jobs/${id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { success: true } });

    const repeat = await request(`/jobs/${id}`, { method: 'DELETE' });
    expect(repeat.status).toBe(404);
  });
});
