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
  it('sets isDemo: true, ignored: false, reason: "", and stamps timestamps', async () => {
    const created = await createBloodPressureMeasurement(db, 'bp-1', baseInput);
    expect(created.isDemo).toBe(true);
    expect(created.ignored).toBe(false);
    expect(created.reason).toBe('');
    expect(created.createdAt).toBe(created.updatedAt);
  });
});

describe('updateBloodPressureMeasurement', () => {
  it('supports an ignore update and returns undefined for a missing id', async () => {
    await createBloodPressureMeasurement(db, 'bp-2', baseInput);
    const updated = await updateBloodPressureMeasurement(db, 'bp-2', {
      ignored: true,
      reason: 'Wrong cuff',
    });
    expect(updated?.ignored).toBe(true);
    expect(
      await updateBloodPressureMeasurement(db, 'nope', { ignored: true, reason: 'x' }),
    ).toBeUndefined();
  });

  it('throws if called directly with ignored: true and no reason, bypassing Zod', async () => {
    await createBloodPressureMeasurement(db, 'bp-4', baseInput);
    await expect(updateBloodPressureMeasurement(db, 'bp-4', { ignored: true })).rejects.toThrow(
      'reason is required when ignored is true',
    );
  });
});

describe('listBloodPressureMeasurements / findBloodPressureMeasurementById', () => {
  it('lists and finds created records', async () => {
    await createBloodPressureMeasurement(db, 'bp-3', baseInput);
    const rows = await listBloodPressureMeasurements(db, {});
    expect(rows.map((r) => r.id)).toEqual(['bp-3']);
    expect((await findBloodPressureMeasurementById(db, 'bp-3'))?.systolic).toBe(120);
  });
});
