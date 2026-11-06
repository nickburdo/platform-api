import { beforeEach, describe, expect, it } from 'vitest';
import type { HealthMonitorDb } from '../db/health-monitor/client';
import { bloodPressureMeasurements } from '../db/health-monitor/schema';
import { freshHealthMonitorDb } from '../db/health-monitor/test-helpers';
import {
  createBloodPressureMeasurement,
  findBloodPressureMeasurementById,
  listBloodPressureMeasurements,
  updateBloodPressureMeasurement,
} from './blood-pressure.service';

let db: HealthMonitorDb;

beforeEach(async () => {
  db = await freshHealthMonitorDb(bloodPressureMeasurements);
});

const measuredAt = '2026-06-15T08:00:00.000Z';
const baseInput = { measuredAt, systolic: 120, diastolic: 80, pulse: 70 };

describe('createBloodPressureMeasurement', () => {
  it('stores the caller as owner, strips userId, ignored: false, reason: "", and stamps timestamps', async () => {
    const created = await createBloodPressureMeasurement(db, 'bp-1', baseInput, 'user-a');
    expect(created).not.toHaveProperty('userId');
    expect(created).not.toHaveProperty('isDemo');
    expect(await findBloodPressureMeasurementById(db, 'bp-1', 'user-a')).toBeDefined();
    expect(await findBloodPressureMeasurementById(db, 'bp-1', null)).toBeUndefined();
    expect(created.ignored).toBe(false);
    expect(created.reason).toBe('');
    expect(created.createdAt).toBe(created.updatedAt);
  });
});

describe('updateBloodPressureMeasurement', () => {
  it('supports an ignore update and returns undefined for a missing id', async () => {
    await createBloodPressureMeasurement(db, 'bp-2', baseInput, 'user-a');
    const updated = await updateBloodPressureMeasurement(
      db,
      'bp-2',
      { ignored: true, reason: 'Wrong cuff' },
      'user-a',
    );
    expect(updated?.ignored).toBe(true);
    expect(
      await updateBloodPressureMeasurement(db, 'nope', { ignored: true, reason: 'x' }, 'user-a'),
    ).toBeUndefined();
  });

  it('returns undefined when the id exists but outside the requested owner scope', async () => {
    await createBloodPressureMeasurement(db, 'bp-2b', baseInput, 'user-b');
    expect(
      await updateBloodPressureMeasurement(db, 'bp-2b', { ignored: true, reason: 'x' }, 'user-a'),
    ).toBeUndefined();
  });

  it('throws if called directly with ignored: true and no reason, bypassing Zod', async () => {
    await createBloodPressureMeasurement(db, 'bp-4', baseInput, 'user-a');
    await expect(
      updateBloodPressureMeasurement(db, 'bp-4', { ignored: true }, 'user-a'),
    ).rejects.toThrow('reason is required when ignored is true');
  });
});

describe('listBloodPressureMeasurements / findBloodPressureMeasurementById', () => {
  it('lists and finds created records', async () => {
    await createBloodPressureMeasurement(db, 'bp-3', baseInput, 'user-a');
    const rows = await listBloodPressureMeasurements(db, {}, 'user-a');
    expect(rows.map((r) => r.id)).toEqual(['bp-3']);
    expect((await findBloodPressureMeasurementById(db, 'bp-3', 'user-a'))?.systolic).toBe(120);
  });
});
