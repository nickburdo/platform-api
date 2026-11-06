import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { freshAuthDb } from '../db/auth/test-helpers';
import { createHealthMonitorDb } from '../db/health-monitor/client';
import { createBloodPressureMeasurement as createBloodPressureMeasurementRow } from '../db/health-monitor/blood-pressure.repository';
import { bloodPressureMeasurements } from '../db/health-monitor/schema';
import { freshHealthMonitorDb } from '../db/health-monitor/test-helpers';
import {
  bearer,
  request,
  requestJson,
  seedUserAndGetToken,
  type DataEnvelope,
  type ErrorEnvelope,
} from './test-helpers';

const AT = '2026-06-15T08:00:00.000Z';
const VALID_BODY = { measuredAt: AT, systolic: 120, diastolic: 80, pulse: 70 };
const PATH = '/blood-pressure';

beforeEach(async () => {
  await freshHealthMonitorDb(bloodPressureMeasurements);
  await freshAuthDb();
});

// Demo rows are seeded directly: guests cannot write (V4), so the API has no
// way to create them.
async function seedDemo(id: string): Promise<void> {
  await createBloodPressureMeasurementRow(createHealthMonitorDb(env.HEALTH_MONITOR_DB), {
    id,
    measuredAt: AT,
    systolic: 120,
    diastolic: 80,
    pulse: 70,
    userId: null,
    ignored: false,
    reason: '',
    createdAt: AT,
    updatedAt: AT,
  });
}

async function createFor(token: string): Promise<string> {
  const res = await requestJson('POST', PATH, VALID_BODY, bearer(token));
  return ((await res.json()) as DataEnvelope).data.id as string;
}

async function listIds(token?: string): Promise<string[]> {
  const res = await request(PATH, token ? { headers: bearer(token) } : undefined);
  return ((await res.json()) as { data: { id: string }[] }).data.map((r) => r.id);
}

describe('POST /blood-pressure', () => {
  it('creates a measurement for the user, stamping id and server-managed fields', async () => {
    const { token } = await seedUserAndGetToken();
    const res = await requestJson('POST', PATH, VALID_BODY, bearer(token));
    expect(res.status).toBe(201);
    const { data } = (await res.json()) as DataEnvelope;
    expect(typeof data.id).toBe('string');
    expect(data.systolic).toBe(120);
    expect(data.ignored).toBe(false);
    expect(data.reason).toBe('');
    expect(data).not.toHaveProperty('userId');
    expect(data).not.toHaveProperty('isDemo');
  });

  it('rejects systolic <= diastolic with 400', async () => {
    const { token } = await seedUserAndGetToken();
    const res = await requestJson(
      'POST',
      PATH,
      { measuredAt: AT, systolic: 80, diastolic: 90, pulse: 70 },
      bearer(token),
    );
    expect(res.status).toBe(400);
  });

  it('rejects a guest with 401 for a valid body', async () => {
    const res = await requestJson('POST', PATH, VALID_BODY);
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrorEnvelope).error.message).toBe('Authentication required');
  });

  it('rejects a guest with 401, not 400, for an invalid body (guard runs before validation)', async () => {
    const res = await requestJson('POST', PATH, {});
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrorEnvelope).error.message).toBe('Authentication required');
  });
});

describe('GET /blood-pressure', () => {
  it('lists the user own measurements without pagination', async () => {
    const { token } = await seedUserAndGetToken();
    const id = await createFor(token);
    const res = await request(PATH, { headers: bearer(token) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown>[] };
    expect(body.data.map((r) => r.id)).toEqual([id]);
    expect(body).not.toHaveProperty('meta');
    expect(body.data[0]).not.toHaveProperty('userId');
    expect(body.data[0]).not.toHaveProperty('isDemo');
  });

  it('isolates users from each other and from demo data; a guest sees only demo rows', async () => {
    await seedDemo('demo-1');
    const a = await seedUserAndGetToken({ username: 'user-a' });
    const b = await seedUserAndGetToken({ username: 'user-b' });
    const idA = await createFor(a.token);
    const idB = await createFor(b.token);

    expect(await listIds(a.token)).toEqual([idA]);
    expect(await listIds(b.token)).toEqual([idB]);
    expect(await listIds()).toEqual(['demo-1']);
  });

  it('strips userId from demo rows read by a guest', async () => {
    await seedDemo('demo-1');
    const res = await request(PATH);
    const body = (await res.json()) as { data: Record<string, unknown>[] };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).not.toHaveProperty('userId');
    expect(body.data[0]).not.toHaveProperty('isDemo');
  });

  it('rejects a calendar-invalid date_from with 400 (Decision #21)', async () => {
    const res = await request(`${PATH}?date_from=2026-13-01`);
    expect(res.status).toBe(400);
  });
});

describe('PATCH /blood-pressure/:id', () => {
  it('supports the ignore/restore round-trip for the owner', async () => {
    const { token } = await seedUserAndGetToken();
    const id = await createFor(token);

    const ignored = await requestJson(
      'PATCH',
      `${PATH}/${id}`,
      { ignored: true, reason: 'Wrong cuff position' },
      bearer(token),
    );
    expect(ignored.status).toBe(200);
    const ignoredBody = (await ignored.json()) as DataEnvelope;
    expect(ignoredBody.data.ignored).toBe(true);
    expect(ignoredBody.data.reason).toBe('Wrong cuff position');
    expect(ignoredBody.data).not.toHaveProperty('userId');
    expect(ignoredBody.data).not.toHaveProperty('isDemo');

    const restored = await requestJson(
      'PATCH',
      `${PATH}/${id}`,
      { ignored: false, reason: '' },
      bearer(token),
    );
    expect(restored.status).toBe(200);
    expect(((await restored.json()) as DataEnvelope).data.ignored).toBe(false);
  });

  it('rejects an empty body with 400 (Decision #33)', async () => {
    const { token } = await seedUserAndGetToken();
    const id = await createFor(token);
    const res = await requestJson('PATCH', `${PATH}/${id}`, {}, bearer(token));
    expect(res.status).toBe(400);
  });

  it('returns the 404 envelope for an unknown id', async () => {
    const { token } = await seedUserAndGetToken();
    const res = await requestJson('PATCH', `${PATH}/no-such-id`, { pulse: 72 }, bearer(token));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { message: 'Resource not found' } });
  });

  it('rejects a guest ignore request with 401', async () => {
    await seedDemo('demo-1');
    const res = await requestJson('PATCH', `${PATH}/demo-1`, { ignored: true, reason: 'x' });
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrorEnvelope).error.message).toBe('Authentication required');
  });

  it('rejects a guest with 401, not 400, for an invalid body', async () => {
    const res = await requestJson('PATCH', `${PATH}/demo-1`, {});
    expect(res.status).toBe(401);
  });

  it('answers 404 when user B patches user A record, leaving it untouched', async () => {
    const a = await seedUserAndGetToken({ username: 'user-a' });
    const b = await seedUserAndGetToken({ username: 'user-b' });
    const id = await createFor(a.token);

    const res = await requestJson(
      'PATCH',
      `${PATH}/${id}`,
      { ignored: true, reason: 'x' },
      bearer(b.token),
    );
    expect(res.status).toBe(404);

    const list = (await (await request(PATH, { headers: bearer(a.token) })).json()) as {
      data: { ignored: boolean }[];
    };
    expect(list.data[0]?.ignored).toBe(false);
  });

  it('answers 404 when a user patches a demo record', async () => {
    await seedDemo('demo-1');
    const { token } = await seedUserAndGetToken();
    const res = await requestJson(
      'PATCH',
      `${PATH}/demo-1`,
      { ignored: true, reason: 'x' },
      bearer(token),
    );
    expect(res.status).toBe(404);
  });
});
