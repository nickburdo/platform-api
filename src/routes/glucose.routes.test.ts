import { beforeEach, describe, expect, it } from 'vitest';
import { glucoseMeasurements } from '../db/health-monitor/schema';
import { freshHealthMonitorDb } from '../db/health-monitor/test-helpers';
import { request, requestJson, type DataEnvelope } from './test-helpers';

const MEASURED_AT = '2026-06-15T08:00:00.000Z';

beforeEach(async () => {
  await freshHealthMonitorDb(glucoseMeasurements);
});

describe('POST /glucose', () => {
  it('creates a measurement, stamping id and server-managed fields', async () => {
    const res = await requestJson('POST', '/glucose', {
      measuredAt: MEASURED_AT,
      fastingValue: 90,
    });
    expect(res.status).toBe(201);
    const { data } = (await res.json()) as DataEnvelope;
    expect(typeof data.id).toBe('string');
    expect(data.fastingValue).toBe(90);
    expect(data.afterMealValue).toBeNull();
    expect(data.isDemo).toBe(true);
    expect(data.ignored).toBe(false);
    expect(data.reason).toBe('');
  });

  it('rejects both fastingValue and afterMealValue with 400 (Decision #19)', async () => {
    const res = await requestJson('POST', '/glucose', {
      measuredAt: MEASURED_AT,
      fastingValue: 90,
      afterMealValue: 120,
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /glucose', () => {
  it('lists created measurements without pagination', async () => {
    await requestJson('POST', '/glucose', { measuredAt: MEASURED_AT, fastingValue: 90 });
    const res = await request('/glucose');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(1);
    expect(body).not.toHaveProperty('meta');
  });

  it('rejects a calendar-invalid date_from with 400 (Decision #21)', async () => {
    const res = await request('/glucose?date_from=2026-13-01');
    expect(res.status).toBe(400);
  });
});

describe('PATCH /glucose/:id', () => {
  it('supports the ignore/restore round-trip', async () => {
    const created = (await (
      await requestJson('POST', '/glucose', { measuredAt: MEASURED_AT, fastingValue: 90 })
    ).json()) as DataEnvelope;
    const id = created.data.id as string;

    const ignored = await requestJson('PATCH', `/glucose/${id}`, {
      ignored: true,
      reason: 'Incorrect measurement',
    });
    expect(ignored.status).toBe(200);
    const ignoredBody = (await ignored.json()) as DataEnvelope;
    expect(ignoredBody.data.ignored).toBe(true);
    expect(ignoredBody.data.reason).toBe('Incorrect measurement');

    const restored = await requestJson('PATCH', `/glucose/${id}`, {
      ignored: false,
      reason: '',
    });
    expect(restored.status).toBe(200);
    const restoredBody = (await restored.json()) as DataEnvelope;
    expect(restoredBody.data.ignored).toBe(false);
  });

  it('rejects an empty body with 400 (Decision #33)', async () => {
    const created = (await (
      await requestJson('POST', '/glucose', { measuredAt: MEASURED_AT, fastingValue: 90 })
    ).json()) as DataEnvelope;
    const res = await requestJson('PATCH', `/glucose/${created.data.id as string}`, {});
    expect(res.status).toBe(400);
  });

  it('returns the 404 envelope for an unknown id', async () => {
    const res = await requestJson('PATCH', '/glucose/no-such-id', { fastingValue: 95 });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { message: 'Resource not found' } });
  });
});
