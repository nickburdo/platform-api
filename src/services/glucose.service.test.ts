import { beforeEach, describe, expect, it } from 'vitest';
import type { HealthMonitorDb } from '../db/health-monitor/client';
import { glucoseMeasurements } from '../db/health-monitor/schema';
import { freshHealthMonitorDb } from '../db/health-monitor/test-helpers';
import {
  createGlucoseMeasurement,
  findGlucoseMeasurementById,
  listGlucoseMeasurements,
  updateGlucoseMeasurement,
} from './glucose.service';

let db: HealthMonitorDb;

beforeEach(async () => {
  db = await freshHealthMonitorDb(glucoseMeasurements);
});

const measuredAt = '2026-06-15T08:00:00.000Z';

describe('createGlucoseMeasurement', () => {
  it('sets isDemo from the caller scope, ignored: false, reason: "", and stamps timestamps', async () => {
    const created = await createGlucoseMeasurement(
      db,
      'g-1',
      { measuredAt, fastingValue: 90 },
      true,
    );
    expect(created.isDemo).toBe(true);
    expect(created.ignored).toBe(false);
    expect(created.reason).toBe('');
    expect(created.createdAt).toBe(created.updatedAt);
  });
});

describe('updateGlucoseMeasurement', () => {
  it('nulls out afterMealValue when fastingValue is patched, preserving the exactly-one invariant', async () => {
    await createGlucoseMeasurement(db, 'g-2', { measuredAt, afterMealValue: 120 }, true);
    const updated = await updateGlucoseMeasurement(db, 'g-2', { fastingValue: 95 }, true);
    expect(updated?.fastingValue).toBe(95);
    expect(updated?.afterMealValue).toBeNull();
  });

  it('nulls out fastingValue when afterMealValue is patched, preserving the exactly-one invariant', async () => {
    await createGlucoseMeasurement(db, 'g-2b', { measuredAt, fastingValue: 88 }, true);
    const updated = await updateGlucoseMeasurement(db, 'g-2b', { afterMealValue: 140 }, true);
    expect(updated?.afterMealValue).toBe(140);
    expect(updated?.fastingValue).toBeNull();
  });

  it('returns undefined for a missing id', async () => {
    expect(
      await updateGlucoseMeasurement(db, 'nope', { ignored: true, reason: 'x' }, true),
    ).toBeUndefined();
  });

  it('returns undefined when the id exists but outside the requested isDemo scope', async () => {
    await createGlucoseMeasurement(db, 'g-2c', { measuredAt, fastingValue: 90 }, false);
    expect(
      await updateGlucoseMeasurement(db, 'g-2c', { fastingValue: 95 }, true),
    ).toBeUndefined();
  });

  it('throws if called directly with ignored: true and no reason, bypassing Zod', async () => {
    await createGlucoseMeasurement(db, 'g-4', { measuredAt, fastingValue: 90 }, true);
    await expect(updateGlucoseMeasurement(db, 'g-4', { ignored: true }, true)).rejects.toThrow(
      'reason is required when ignored is true',
    );
  });
});

describe('listGlucoseMeasurements / findGlucoseMeasurementById', () => {
  it('lists and finds created records', async () => {
    await createGlucoseMeasurement(db, 'g-3', { measuredAt, fastingValue: 88 }, true);
    const rows = await listGlucoseMeasurements(db, {}, true);
    expect(rows.map((r) => r.id)).toEqual(['g-3']);
    expect((await findGlucoseMeasurementById(db, 'g-3', true))?.fastingValue).toBe(88);
  });
});
