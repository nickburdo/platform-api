import { beforeEach, describe, expect, it } from 'vitest';
import {
  createBloodPressureMeasurement,
  findBloodPressureMeasurementById,
  listBloodPressureMeasurements,
  updateBloodPressureMeasurement,
} from './blood-pressure.repository';
import type { HealthMonitorDb } from './client';
import { bloodPressureMeasurements, type NewBloodPressureMeasurement } from './schema';
import { freshHealthMonitorDb } from './test-helpers';

let db: HealthMonitorDb;

beforeEach(async () => {
  db = await freshHealthMonitorDb(bloodPressureMeasurements);
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
    userId: null,
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

    const found = await findBloodPressureMeasurementById(db, 'bp-1', null);
    expect(found?.systolic).toBe(130);
  });

  it('returns undefined when the id exists but outside the requested owner scope', async () => {
    await createBloodPressureMeasurement(db, makeRow({ id: 'bp-1b', userId: 'user-a' }));
    expect(await findBloodPressureMeasurementById(db, 'bp-1b', null)).toBeUndefined();
    expect((await findBloodPressureMeasurementById(db, 'bp-1b', 'user-a'))?.id).toBe('bp-1b');
  });
});

describe('updateBloodPressureMeasurement', () => {
  it('supports an ignore-only update', async () => {
    await createBloodPressureMeasurement(db, makeRow({ id: 'bp-2' }));
    const updated = await updateBloodPressureMeasurement(
      db,
      'bp-2',
      { ignored: true, reason: 'Wrong cuff position' },
      null,
    );
    expect(updated?.ignored).toBe(true);
    expect(updated?.systolic).toBe(120);
  });

  it('returns undefined when the id exists but outside the requested owner scope', async () => {
    await createBloodPressureMeasurement(db, makeRow({ id: 'bp-2b', userId: 'user-a' }));
    expect(
      await updateBloodPressureMeasurement(db, 'bp-2b', { ignored: true, reason: 'x' }, null),
    ).toBeUndefined();
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
    const rows = await listBloodPressureMeasurements(db, {
      ownerId: null,
      date_from: '2026-06-10',
    });
    expect(rows.map((r) => r.id)).toEqual(['d-2']);
  });

  it('returns only the requested owner scope', async () => {
    await createBloodPressureMeasurement(
      db,
      makeRow({ id: 'u-1', measuredAt: '2026-06-12T08:00:00.000Z', userId: 'user-a' }),
    );
    const own = await listBloodPressureMeasurements(db, { ownerId: 'user-a' });
    expect(own.map((r) => r.id)).toEqual(['u-1']);
    const demo = await listBloodPressureMeasurements(db, { ownerId: null });
    expect(demo.map((r) => r.id)).toEqual(['d-1', 'd-2']);
    expect(await listBloodPressureMeasurements(db, { ownerId: 'user-b' })).toEqual([]);
  });
});
