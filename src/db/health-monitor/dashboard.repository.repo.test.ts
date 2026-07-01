import { beforeEach, describe, expect, it } from 'vitest';
import { createBloodPressureMeasurement } from './blood-pressure.repository';
import type { HealthMonitorDb } from './client';
import { getDashboardData } from './dashboard.repository';
import { createGlucoseMeasurement } from './glucose.repository';
import {
  bloodPressureMeasurements,
  glucoseMeasurements,
  symptomEntries,
  weightMeasurements,
} from './schema';
import { createSymptomEntry } from './symptoms.repository';
import { freshHealthMonitorDb } from './test-helpers';
import { createWeightMeasurement } from './weight.repository';

let db: HealthMonitorDb;

beforeEach(async () => {
  db = await freshHealthMonitorDb(
    glucoseMeasurements,
    bloodPressureMeasurements,
    weightMeasurements,
    symptomEntries,
  );
});

const commonFields = {
  isDemo: true,
  ignored: false,
  reason: '',
  createdAt: '2026-06-15T08:00:00.000Z',
  updatedAt: '2026-06-15T08:00:00.000Z',
};

describe('getDashboardData', () => {
  it('aggregates all four Health Monitor resources for the same date range', async () => {
    await Promise.all([
      createGlucoseMeasurement(db, {
        id: 'g-1',
        measuredAt: '2026-06-15T08:00:00.000Z',
        fastingValue: 90,
        ...commonFields,
      }),
      createBloodPressureMeasurement(db, {
        id: 'bp-1',
        measuredAt: '2026-06-15T08:00:00.000Z',
        systolic: 120,
        diastolic: 80,
        pulse: 70,
        ...commonFields,
      }),
      createWeightMeasurement(db, {
        id: 'w-1',
        measuredAt: '2026-06-15T08:00:00.000Z',
        value: 84.6,
        ...commonFields,
      }),
      createSymptomEntry(db, {
        id: 's-1',
        happenedAt: '2026-06-15T08:00:00.000Z',
        type: 'headache',
        intensity: 3,
        ...commonFields,
      }),
      // Outside the requested range — should not appear in the result.
      createGlucoseMeasurement(db, {
        id: 'g-2',
        measuredAt: '2026-01-01T08:00:00.000Z',
        fastingValue: 95,
        ...commonFields,
      }),
    ]);

    const data = await getDashboardData(db, { date_from: '2026-06-01', date_to: '2026-06-30' });

    expect(data.glucoseMeasurements.map((r) => r.id)).toEqual(['g-1']);
    expect(data.bloodPressureMeasurements.map((r) => r.id)).toEqual(['bp-1']);
    expect(data.weightMeasurements.map((r) => r.id)).toEqual(['w-1']);
    expect(data.symptomEntries.map((r) => r.id)).toEqual(['s-1']);
  });

  it('returns empty arrays for each resource when nothing matches', async () => {
    const data = await getDashboardData(db, { date_from: '2026-01-01', date_to: '2026-01-31' });
    expect(data).toEqual({
      glucoseMeasurements: [],
      bloodPressureMeasurements: [],
      weightMeasurements: [],
      symptomEntries: [],
    });
  });
});
