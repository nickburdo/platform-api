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
    await createGlucoseMeasurement(
      db,
      'g-1',
      { measuredAt: '2026-06-15T08:00:00.000Z', fastingValue: 90 },
      'user-a',
    );

    const data = await getDashboardData(db, {}, 'user-a');
    expect(data.glucoseMeasurements.map((r) => r.id)).toEqual(['g-1']);
    expect(data.bloodPressureMeasurements).toEqual([]);
    expect(data.weightMeasurements).toEqual([]);
    expect(data.symptomEntries).toEqual([]);
  });

  it('scopes by owner and strips userId from every row', async () => {
    await createGlucoseMeasurement(
      db,
      'g-user',
      { measuredAt: '2026-06-15T08:00:00.000Z', fastingValue: 90 },
      'user-a',
    );
    await createGlucoseMeasurementRow(db, {
      id: 'g-demo',
      measuredAt: '2026-06-15T08:00:00.000Z',
      fastingValue: 95,
      userId: null,
      ignored: false,
      reason: '',
      createdAt: '2026-06-15T08:00:00.000Z',
      updatedAt: '2026-06-15T08:00:00.000Z',
    });

    const userData = await getDashboardData(db, {}, 'user-a');
    expect(userData.glucoseMeasurements.map((r) => r.id)).toEqual(['g-user']);
    for (const row of userData.glucoseMeasurements) {
      expect(row).not.toHaveProperty('userId');
      expect(row).not.toHaveProperty('isDemo');
    }

    const guestData = await getDashboardData(db, {}, null);
    expect(guestData.glucoseMeasurements.map((r) => r.id)).toEqual(['g-demo']);
    for (const row of guestData.glucoseMeasurements) {
      expect(row).not.toHaveProperty('userId');
    }
  });
});
