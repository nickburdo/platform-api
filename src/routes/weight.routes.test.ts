import { beforeEach, describe, expect, it } from 'vitest';
import { weightMeasurements } from '../db/health-monitor/schema';
import { freshHealthMonitorDb } from '../db/health-monitor/test-helpers';
import { request, requestJson } from './test-helpers';

interface DataEnvelope {
  data: Record<string, unknown>;
}

const MEASURED_AT = '2026-06-15T08:00:00.000Z';

beforeEach(async () => {
  await freshHealthMonitorDb(weightMeasurements);
});

describe('POST /weight', () => {
  it('creates a measurement, stamping id and server-managed fields', async () => {
    const res = await requestJson('POST', '/weight', { measuredAt: MEASURED_AT, value: 82.5 });
    expect(res.status).toBe(201);
    const { data } = (await res.json()) as DataEnvelope;
    expect(typeof data.id).toBe('string');
    expect(data.value).toBe(82.5);
    expect(data.isDemo).toBe(true);
  });

  it('rejects a non-positive value with 400', async () => {
    const res = await requestJson('POST', '/weight', { measuredAt: MEASURED_AT, value: 0 });
    expect(res.status).toBe(400);
  });
});

describe('GET /weight', () => {
  it('lists created measurements', async () => {
    await requestJson('POST', '/weight', { measuredAt: MEASURED_AT, value: 82.5 });
    const res = await request('/weight');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });
});

describe('PATCH /weight/:id', () => {
  it('supports the ignore/restore round-trip', async () => {
    const created = (await (
      await requestJson('POST', '/weight', { measuredAt: MEASURED_AT, value: 82.5 })
    ).json()) as DataEnvelope;
    const id = created.data.id as string;

    const ignored = await requestJson('PATCH', `/weight/${id}`, {
      ignored: true,
      reason: 'Measurement duplicated',
    });
    expect(ignored.status).toBe(200);
    expect(((await ignored.json()) as DataEnvelope).data.ignored).toBe(true);

    const restored = await requestJson('PATCH', `/weight/${id}`, { ignored: false, reason: '' });
    expect(((await restored.json()) as DataEnvelope).data.ignored).toBe(false);
  });

  it('returns the 404 envelope for an unknown id', async () => {
    const res = await requestJson('PATCH', '/weight/no-such-id', { value: 81 });
    expect(res.status).toBe(404);
  });
});
