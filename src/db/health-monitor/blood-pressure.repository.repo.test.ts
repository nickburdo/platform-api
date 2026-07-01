import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createBloodPressureMeasurement,
  findBloodPressureMeasurementById,
  listBloodPressureMeasurements,
  updateBloodPressureMeasurement,
} from './blood-pressure.repository';
import { createHealthMonitorDb, type HealthMonitorDb } from './client';
import { bloodPressureMeasurements, type NewBloodPressureMeasurement } from './schema';

let db: HealthMonitorDb;

beforeEach(async () => {
  db = createHealthMonitorDb(env.HEALTH_MONITOR_DB);
  await db.delete(bloodPressureMeasurements);
});

function makeRow(
  overrides: Partial<NewBloodPressureMeasurement> = {},
): NewBloodPressureMeasurement {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    measuredAt: '2026-06-15T08:00:00.000Z',
    systolic: 120,
    diastolic: 80,
    pulse: 70,
    isDemo: true,
    ignored: false,
    reason: '',
    createdAt: '2026-06-15T08:00:00.000Z',
    updatedAt: '2026-06-15T08:00:00.000Z',
    ...overrides,
  };
}

describe('createBloodPressureMeasurement / findBloodPressureMeasurementById', () => {
  it('creates a row and finds it by id', async () => {
    const created = await createBloodPressureMeasurement(
      db,
      makeRow({ id: 'bp-1', systolic: 130 }),
    );
    expect(created.systolic).toBe(130);

    const found = await findBloodPressureMeasurementById(db, 'bp-1');
    expect(found?.systolic).toBe(130);
  });
});

describe('updateBloodPressureMeasurement', () => {
  it('supports an ignore-only update', async () => {
    await createBloodPressureMeasurement(db, makeRow({ id: 'bp-2' }));
    const updated = await updateBloodPressureMeasurement(db, 'bp-2', {
      ignored: true,
      reason: 'Wrong cuff position',
    });
    expect(updated?.ignored).toBe(true);
    expect(updated?.systolic).toBe(120);
  });
});

describe('listBloodPressureMeasurements', () => {
  beforeEach(async () => {
    await Promise.all([
      createBloodPressureMeasurement(
        db,
        makeRow({ id: 'd-1', measuredAt: '2026-06-01T08:00:00.000Z' }),
      ),
      createBloodPressureMeasurement(
        db,
        makeRow({ id: 'd-2', measuredAt: '2026-06-15T08:00:00.000Z' }),
      ),
    ]);
  });

  it('filters by date range', async () => {
    const rows = await listBloodPressureMeasurements(db, { date_from: '2026-06-10' });
    expect(rows.map((r) => r.id)).toEqual(['d-2']);
  });
});
