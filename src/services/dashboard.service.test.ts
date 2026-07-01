import { beforeEach, describe, expect, it } from 'vitest';
import type { HealthMonitorDb } from '../db/health-monitor/client';
import { createGlucoseMeasurement as createGlucoseMeasurementRow } from '../db/health-monitor/glucose.repository';
import {
  bloodPressureMeasurements,
  glucoseMeasurements,
  symptomEntries,
  weightMeasurements,
} from '../db/health-monitor/schema';
import { freshHealthMonitorDb } from '../db/health-monitor/test-helpers';
import { getDashboardData } from './dashboard.service';
import { createGlucoseMeasurement } from './glucose.service';

let db: HealthMonitorDb;

beforeEach(async () => {
  db = await freshHealthMonitorDb(
    glucoseMeasurements,
    bloodPressureMeasurements,
    weightMeasurements,
    symptomEntries,
  );
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

  it('scopes by isDemo when provided', async () => {
    await createGlucoseMeasurement(db, 'g-demo', {
      measuredAt: '2026-06-15T08:00:00.000Z',
      fastingValue: 90,
    });
    await createGlucoseMeasurementRow(db, {
      id: 'g-real',
      measuredAt: '2026-06-15T08:00:00.000Z',
      fastingValue: 95,
      isDemo: false,
      ignored: false,
      reason: '',
      createdAt: '2026-06-15T08:00:00.000Z',
      updatedAt: '2026-06-15T08:00:00.000Z',
    });

    const demoData = await getDashboardData(db, { isDemo: true });
    expect(demoData.glucoseMeasurements.map((r) => r.id)).toEqual(['g-demo']);

    const realData = await getDashboardData(db, { isDemo: false });
    expect(realData.glucoseMeasurements.map((r) => r.id)).toEqual(['g-real']);
  });
});
