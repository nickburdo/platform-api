import { beforeEach, describe, expect, it } from 'vitest';
import type { HealthMonitorDb } from './client';
import { weightMeasurements, type NewWeightMeasurement } from './schema';
import { freshHealthMonitorDb } from './test-helpers';
import {
  createWeightMeasurement,
  findWeightMeasurementById,
  listWeightMeasurements,
  updateWeightMeasurement,
} from './weight.repository';

let db: HealthMonitorDb;

beforeEach(async () => {
  db = await freshHealthMonitorDb(weightMeasurements);
});

function makeRow(overrides: Partial<NewWeightMeasurement> = {}): NewWeightMeasurement {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    measuredAt: '2026-06-15T08:00:00.000Z',
    value: 84.6,
    isDemo: true,
    ignored: false,
    reason: '',
    createdAt: '2026-06-15T08:00:00.000Z',
    updatedAt: '2026-06-15T08:00:00.000Z',
    ...overrides,
  };
}

describe('createWeightMeasurement / findWeightMeasurementById', () => {
  it('creates a row and finds it by id', async () => {
    const created = await createWeightMeasurement(db, makeRow({ id: 'w-1', value: 85.2 }));
    expect(created.value).toBe(85.2);

    const found = await findWeightMeasurementById(db, 'w-1', true);
    expect(found?.value).toBe(85.2);
  });

  it('returns undefined when the id exists but outside the requested isDemo scope', async () => {
    await createWeightMeasurement(db, makeRow({ id: 'w-1b', isDemo: false }));
    expect(await findWeightMeasurementById(db, 'w-1b', true)).toBeUndefined();
    expect((await findWeightMeasurementById(db, 'w-1b', false))?.id).toBe('w-1b');
  });
});

describe('updateWeightMeasurement', () => {
  it('supports an ignore-only update', async () => {
    await createWeightMeasurement(db, makeRow({ id: 'w-2' }));
    const updated = await updateWeightMeasurement(
      db,
      'w-2',
      { ignored: true, reason: 'Duplicate entry' },
      true,
    );
    expect(updated?.ignored).toBe(true);
    expect(updated?.value).toBe(84.6);
  });

  it('returns undefined when the id exists but outside the requested isDemo scope', async () => {
    await createWeightMeasurement(db, makeRow({ id: 'w-2b', isDemo: false }));
    expect(
      await updateWeightMeasurement(db, 'w-2b', { ignored: true, reason: 'x' }, true),
    ).toBeUndefined();
  });
});

describe('listWeightMeasurements', () => {
  it('filters by date range', async () => {
    await Promise.all([
      createWeightMeasurement(db, makeRow({ id: 'd-1', measuredAt: '2026-06-01T08:00:00.000Z' })),
      createWeightMeasurement(db, makeRow({ id: 'd-2', measuredAt: '2026-06-15T08:00:00.000Z' })),
    ]);
    const rows = await listWeightMeasurements(db, { date_from: '2026-06-10' });
    expect(rows.map((r) => r.id)).toEqual(['d-2']);
  });
});
