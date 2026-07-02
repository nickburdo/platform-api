import { beforeEach, describe, expect, it } from 'vitest';
import { bloodPressureMeasurements } from '../db/health-monitor/schema';
import { freshHealthMonitorDb } from '../db/health-monitor/test-helpers';
import { request, requestJson } from './test-helpers';

interface DataEnvelope {
  data: Record<string, unknown>;
}

const MEASURED_AT = '2026-06-15T08:00:00.000Z';
const VALID_BODY = { measuredAt: MEASURED_AT, systolic: 120, diastolic: 80, pulse: 70 };

beforeEach(async () => {
  await freshHealthMonitorDb(bloodPressureMeasurements);
});

describe('POST /blood-pressure', () => {
  it('creates a measurement, stamping id and server-managed fields', async () => {
    const res = await requestJson('POST', '/blood-pressure', VALID_BODY);
    expect(res.status).toBe(201);
    const { data } = (await res.json()) as DataEnvelope;
    expect(typeof data.id).toBe('string');
    expect(data.systolic).toBe(120);
    expect(data.isDemo).toBe(true);
    expect(data.ignored).toBe(false);
  });

  it('rejects systolic <= diastolic with 400', async () => {
    const res = await requestJson('POST', '/blood-pressure', {
      ...VALID_BODY,
      systolic: 80,
      diastolic: 90,
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /blood-pressure', () => {
  it('lists created measurements', async () => {
    await requestJson('POST', '/blood-pressure', VALID_BODY);
    const res = await request('/blood-pressure');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });
});

describe('PATCH /blood-pressure/:id', () => {
  it('supports the ignore/restore round-trip', async () => {
    const created = (await (
      await requestJson('POST', '/blood-pressure', VALID_BODY)
    ).json()) as DataEnvelope;
    const id = created.data.id as string;

    const ignored = await requestJson('PATCH', `/blood-pressure/${id}`, {
      ignored: true,
      reason: 'Wrong cuff position',
    });
    expect(ignored.status).toBe(200);
    expect(((await ignored.json()) as DataEnvelope).data.ignored).toBe(true);

    const restored = await requestJson('PATCH', `/blood-pressure/${id}`, {
      ignored: false,
      reason: '',
    });
    expect(((await restored.json()) as DataEnvelope).data.ignored).toBe(false);
  });

  it('returns the 404 envelope for an unknown id', async () => {
    const res = await requestJson('PATCH', '/blood-pressure/no-such-id', { pulse: 72 });
    expect(res.status).toBe(404);
  });
});
