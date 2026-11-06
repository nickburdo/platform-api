import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { freshAuthDb } from '../db/auth/test-helpers';
import { createHealthMonitorDb } from '../db/health-monitor/client';
import { createGlucoseMeasurement as createGlucoseRow } from '../db/health-monitor/glucose.repository';
import {
  bloodPressureMeasurements,
  glucoseMeasurements,
  symptomEntries,
  weightMeasurements,
} from '../db/health-monitor/schema';
import { freshHealthMonitorDb } from '../db/health-monitor/test-helpers';
import { bearer, request, requestJson, seedUserAndGetToken } from './test-helpers';

const AT = '2026-06-15T08:00:00.000Z';

interface DashboardBody {
  data: {
    glucoseMeasurements: Record<string, unknown>[];
    bloodPressureMeasurements: Record<string, unknown>[];
    weightMeasurements: Record<string, unknown>[];
    symptomEntries: Record<string, unknown>[];
  };
}

beforeEach(async () => {
  await freshHealthMonitorDb(
    glucoseMeasurements,
    bloodPressureMeasurements,
    weightMeasurements,
    symptomEntries,
  );
  await freshAuthDb();
});

// Demo rows are seeded directly: guests cannot write (V4).
async function seedDemoGlucose(id: string): Promise<void> {
  await createGlucoseRow(createHealthMonitorDb(env.HEALTH_MONITOR_DB), {
    id,
    measuredAt: AT,
    fastingValue: 90,
    userId: null,
    ignored: false,
    reason: '',
    createdAt: AT,
    updatedAt: AT,
  });
}

async function seedAllFor(token: string): Promise<void> {
  const headers = bearer(token);
  await requestJson('POST', '/glucose', { measuredAt: AT, fastingValue: 90 }, headers);
  await requestJson(
    'POST',
    '/blood-pressure',
    { measuredAt: AT, systolic: 120, diastolic: 80, pulse: 70 },
    headers,
  );
  await requestJson('POST', '/weight', { measuredAt: AT, value: 82.5 }, headers);
  await requestJson(
    'POST',
    '/symptoms',
    { happenedAt: AT, type: 'HEADACHE', intensity: 3 },
    headers,
  );
}

describe('GET /dashboard', () => {
  it('aggregates all four Health Monitor resources of the user into one envelope', async () => {
    const { token } = await seedUserAndGetToken();
    await seedAllFor(token);

    const res = await request('/dashboard', { headers: bearer(token) });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as DashboardBody;
    expect(data.glucoseMeasurements).toHaveLength(1);
    expect(data.bloodPressureMeasurements).toHaveLength(1);
    expect(data.weightMeasurements).toHaveLength(1);
    expect(data.symptomEntries).toHaveLength(1);
  });

  it('strips userId and isDemo from every row of every array', async () => {
    const { token } = await seedUserAndGetToken();
    await seedAllFor(token);

    const { data } = (await (
      await request('/dashboard', { headers: bearer(token) })
    ).json()) as DashboardBody;
    for (const rows of Object.values(data)) {
      for (const row of rows) {
        expect(row).not.toHaveProperty('userId');
        expect(row).not.toHaveProperty('isDemo');
      }
    }
  });

  it('shows a user only their own rows, no demo rows; a guest sees only demo rows', async () => {
    await seedDemoGlucose('demo-1');
    const a = await seedUserAndGetToken({ username: 'user-a' });
    const b = await seedUserAndGetToken({ username: 'user-b' });
    await seedAllFor(a.token);

    const dashA = (await (
      await request('/dashboard', { headers: bearer(a.token) })
    ).json()) as DashboardBody;
    expect(dashA.data.glucoseMeasurements).toHaveLength(1);
    expect(dashA.data.glucoseMeasurements[0]?.id).not.toBe('demo-1');
    expect(dashA.data.bloodPressureMeasurements).toHaveLength(1);

    const dashB = (await (
      await request('/dashboard', { headers: bearer(b.token) })
    ).json()) as DashboardBody;
    expect(dashB.data.glucoseMeasurements).toEqual([]);
    expect(dashB.data.bloodPressureMeasurements).toEqual([]);

    const guest = (await (await request('/dashboard')).json()) as DashboardBody;
    expect(guest.data.glucoseMeasurements.map((r) => r.id)).toEqual(['demo-1']);
    expect(guest.data.bloodPressureMeasurements).toEqual([]);
    expect(guest.data.glucoseMeasurements[0]).not.toHaveProperty('userId');
  });

  it('rejects an invalid date range with 400', async () => {
    const res = await request('/dashboard?date_from=2026-06-30&date_to=2026-06-01');
    expect(res.status).toBe(400);
  });
});
