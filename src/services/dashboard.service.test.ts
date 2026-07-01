import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { createHealthMonitorDb, type HealthMonitorDb } from '../db/health-monitor/client';
import {
  bloodPressureMeasurements,
  glucoseMeasurements,
  symptomEntries,
  weightMeasurements,
} from '../db/health-monitor/schema';
import { createGlucoseMeasurement } from './glucose.service';
import { getDashboardData } from './dashboard.service';

let db: HealthMonitorDb;

beforeEach(async () => {
  db = createHealthMonitorDb(env.HEALTH_MONITOR_DB);
  await Promise.all([
    db.delete(glucoseMeasurements),
    db.delete(bloodPressureMeasurements),
    db.delete(weightMeasurements),
    db.delete(symptomEntries),
  ]);
});

describe('getDashboardData', () => {
  it('delegates to the repository composition and returns all four resources', async () => {
    await createGlucoseMeasurement(db, 'g-1', {
      measuredAt: '2026-06-15T08:00:00.000Z',
      fastingValue: 90,
    });

    const data = await getDashboardData(db, {});
    expect(data.glucoseMeasurements.map((r) => r.id)).toEqual(['g-1']);
    expect(data.bloodPressureMeasurements).toEqual([]);
    expect(data.weightMeasurements).toEqual([]);
    expect(data.symptomEntries).toEqual([]);
  });
});
