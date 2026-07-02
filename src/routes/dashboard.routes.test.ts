import { beforeEach, describe, expect, it } from 'vitest';
import {
  bloodPressureMeasurements,
  glucoseMeasurements,
  symptomEntries,
  weightMeasurements,
} from '../db/health-monitor/schema';
import { freshHealthMonitorDb } from '../db/health-monitor/test-helpers';
import { request, requestJson } from './test-helpers';

beforeEach(async () => {
  await freshHealthMonitorDb(
    glucoseMeasurements,
    bloodPressureMeasurements,
    weightMeasurements,
    symptomEntries,
  );
});

describe('GET /dashboard', () => {
  it('aggregates all four Health Monitor resources into one envelope', async () => {
    await requestJson('POST', '/glucose', {
      measuredAt: '2026-06-15T08:00:00.000Z',
      fastingValue: 90,
    });

    const res = await request('/dashboard');
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as {
      data: {
        glucoseMeasurements: unknown[];
        bloodPressureMeasurements: unknown[];
        weightMeasurements: unknown[];
        symptomEntries: unknown[];
      };
    };
    expect(data.glucoseMeasurements).toHaveLength(1);
    expect(data.bloodPressureMeasurements).toEqual([]);
    expect(data.weightMeasurements).toEqual([]);
    expect(data.symptomEntries).toEqual([]);
  });

  it('rejects an invalid date range with 400', async () => {
    const res = await request('/dashboard?date_from=2026-06-30&date_to=2026-06-01');
    expect(res.status).toBe(400);
  });
});
