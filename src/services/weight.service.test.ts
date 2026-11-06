import { beforeEach, describe, expect, it } from 'vitest';
import type { HealthMonitorDb } from '../db/health-monitor/client';
import { weightMeasurements } from '../db/health-monitor/schema';
import { freshHealthMonitorDb } from '../db/health-monitor/test-helpers';
import {
  createWeightMeasurement,
  findWeightMeasurementById,
  listWeightMeasurements,
  updateWeightMeasurement,
} from './weight.service';

let db: HealthMonitorDb;

beforeEach(async () => {
  db = await freshHealthMonitorDb(weightMeasurements);
});

const measuredAt = '2026-06-15T08:00:00.000Z';

describe('createWeightMeasurement', () => {
  it('stores the caller as owner, strips userId, ignored: false, reason: "", and stamps timestamps', async () => {
    const created = await createWeightMeasurement(db, 'w-1', { measuredAt, value: 84.6 }, 'user-a');
    expect(created).not.toHaveProperty('userId');
    expect(created).not.toHaveProperty('isDemo');
    expect(await findWeightMeasurementById(db, 'w-1', 'user-a')).toBeDefined();
    expect(await findWeightMeasurementById(db, 'w-1', null)).toBeUndefined();
    expect(created.ignored).toBe(false);
    expect(created.reason).toBe('');
    expect(created.createdAt).toBe(created.updatedAt);
  });
});

describe('updateWeightMeasurement', () => {
  it('returns undefined for a missing id', async () => {
    expect(
      await updateWeightMeasurement(db, 'nope', { ignored: true, reason: 'x' }, 'user-a'),
    ).toBeUndefined();
  });

  it('returns undefined when the id exists but outside the requested owner scope', async () => {
    await createWeightMeasurement(db, 'w-3b', { measuredAt, value: 84.6 }, 'user-b');
    expect(
      await updateWeightMeasurement(db, 'w-3b', { ignored: true, reason: 'x' }, 'user-a'),
    ).toBeUndefined();
  });

  it('throws if called directly with ignored: true and no reason, bypassing Zod', async () => {
    await createWeightMeasurement(db, 'w-3', { measuredAt, value: 84.6 }, 'user-a');
    await expect(updateWeightMeasurement(db, 'w-3', { ignored: true }, 'user-a')).rejects.toThrow(
      'reason is required when ignored is true',
    );
  });
});

describe('listWeightMeasurements / findWeightMeasurementById', () => {
  it('lists and finds created records', async () => {
    await createWeightMeasurement(db, 'w-2', { measuredAt, value: 85.0 }, 'user-a');
    const rows = await listWeightMeasurements(db, {}, 'user-a');
    expect(rows.map((r) => r.id)).toEqual(['w-2']);
    expect((await findWeightMeasurementById(db, 'w-2', 'user-a'))?.value).toBe(85.0);
  });
});
