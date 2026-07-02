import { beforeEach, describe, expect, it } from 'vitest';
import { symptomEntries } from '../db/health-monitor/schema';
import { freshHealthMonitorDb } from '../db/health-monitor/test-helpers';
import { request, requestJson, type DataEnvelope } from './test-helpers';

const HAPPENED_AT = '2026-06-15T08:00:00.000Z';
const VALID_BODY = { happenedAt: HAPPENED_AT, type: 'HEADACHE', intensity: 3 };

beforeEach(async () => {
  await freshHealthMonitorDb(symptomEntries);
});

describe('POST /symptoms', () => {
  it('creates an entry, stamping id and server-managed fields', async () => {
    const res = await requestJson('POST', '/symptoms', VALID_BODY);
    expect(res.status).toBe(201);
    const { data } = (await res.json()) as DataEnvelope;
    expect(typeof data.id).toBe('string');
    expect(data.type).toBe('HEADACHE');
    expect(data.isDemo).toBe(true);
  });

  it('rejects an out-of-range intensity with 400', async () => {
    const res = await requestJson('POST', '/symptoms', { ...VALID_BODY, intensity: 11 });
    expect(res.status).toBe(400);
  });
});

describe('GET /symptoms', () => {
  it('lists created entries', async () => {
    await requestJson('POST', '/symptoms', VALID_BODY);
    const res = await request('/symptoms');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });
});

describe('PATCH /symptoms/:id', () => {
  it('supports the ignore/restore round-trip', async () => {
    const created = (await (
      await requestJson('POST', '/symptoms', VALID_BODY)
    ).json()) as DataEnvelope;
    const id = created.data.id as string;

    const ignored = await requestJson('PATCH', `/symptoms/${id}`, {
      ignored: true,
      reason: 'Created by mistake',
    });
    expect(ignored.status).toBe(200);
    expect(((await ignored.json()) as DataEnvelope).data.ignored).toBe(true);

    const restored = await requestJson('PATCH', `/symptoms/${id}`, { ignored: false, reason: '' });
    expect(((await restored.json()) as DataEnvelope).data.ignored).toBe(false);
  });

  it('returns the 404 envelope for an unknown id', async () => {
    const res = await requestJson('PATCH', '/symptoms/no-such-id', { intensity: 5 });
    expect(res.status).toBe(404);
  });
});
