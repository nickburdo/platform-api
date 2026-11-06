import { beforeEach, describe, expect, it } from 'vitest';
import { deleteHealthDataByUserId } from './account-data.repository';
import {
  createBloodPressureMeasurement,
  listBloodPressureMeasurements,
} from './blood-pressure.repository';
import type { HealthMonitorDb } from './client';
import { createGlucoseMeasurement, listGlucoseMeasurements } from './glucose.repository';
import {
  bloodPressureMeasurements,
  glucoseMeasurements,
  symptomEntries,
  weightMeasurements,
} from './schema';
import { createSymptomEntry, listSymptomEntries } from './symptoms.repository';
import { freshHealthMonitorDb } from './test-helpers';
import { createWeightMeasurement, listWeightMeasurements } from './weight.repository';

let db: HealthMonitorDb;

beforeEach(async () => {
  db = await freshHealthMonitorDb(
    glucoseMeasurements,
    bloodPressureMeasurements,
    weightMeasurements,
    symptomEntries,
  );
});

function stamps(userId: string | null) {
  return {
    userId,
    ignored: false,
    reason: '',
    createdAt: '2026-06-15T08:00:00.000Z',
    updatedAt: '2026-06-15T08:00:00.000Z',
  };
}

async function seedOwner(prefix: string, userId: string | null) {
  const at = '2026-06-15T08:00:00.000Z';
  await createGlucoseMeasurement(db, {
    id: `${prefix}-g`,
    measuredAt: at,
    fastingValue: 90,
    ...stamps(userId),
  });
  await createBloodPressureMeasurement(db, {
    id: `${prefix}-bp`,
    measuredAt: at,
    systolic: 120,
    diastolic: 80,
    pulse: 70,
    ...stamps(userId),
  });
  await createWeightMeasurement(db, {
    id: `${prefix}-w`,
    measuredAt: at,
    value: 84.6,
    ...stamps(userId),
  });
  await createSymptomEntry(db, {
    id: `${prefix}-s`,
    happenedAt: at,
    type: 'headache',
    intensity: 3,
    ...stamps(userId),
  });
}

async function countFor(ownerId: string | null) {
  const [g, bp, w, s] = await Promise.all([
    listGlucoseMeasurements(db, { ownerId }),
    listBloodPressureMeasurements(db, { ownerId }),
    listWeightMeasurements(db, { ownerId }),
    listSymptomEntries(db, { ownerId }),
  ]);
  return [g.length, bp.length, w.length, s.length];
}

describe('deleteHealthDataByUserId', () => {
  it('empties the user rows in all four tables and leaves other users and demo rows', async () => {
    await seedOwner('a', 'user-a');
    await seedOwner('b', 'user-b');
    await seedOwner('d', null);

    await deleteHealthDataByUserId(db, 'user-a');

    expect(await countFor('user-a')).toEqual([0, 0, 0, 0]);
    expect(await countFor('user-b')).toEqual([1, 1, 1, 1]);
    expect(await countFor(null)).toEqual([1, 1, 1, 1]);
  });
});
