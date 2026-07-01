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
  it('sets isDemo: true, ignored: false, reason: "", and stamps timestamps', async () => {
    const created = await createGlucoseMeasurement(db, 'g-1', { measuredAt, fastingValue: 90 });
    expect(created.isDemo).toBe(true);
    expect(created.ignored).toBe(false);
    expect(created.reason).toBe('');
    expect(created.createdAt).toBe(created.updatedAt);
  });
});

describe('updateGlucoseMeasurement', () => {
  it('nulls out afterMealValue when fastingValue is patched, preserving the exactly-one invariant', async () => {
    await createGlucoseMeasurement(db, 'g-2', { measuredAt, afterMealValue: 120 });
    const updated = await updateGlucoseMeasurement(db, 'g-2', { fastingValue: 95 });
    expect(updated?.fastingValue).toBe(95);
    expect(updated?.afterMealValue).toBeNull();
  });

  it('nulls out fastingValue when afterMealValue is patched, preserving the exactly-one invariant', async () => {
    await createGlucoseMeasurement(db, 'g-2b', { measuredAt, fastingValue: 88 });
    const updated = await updateGlucoseMeasurement(db, 'g-2b', { afterMealValue: 140 });
    expect(updated?.afterMealValue).toBe(140);
    expect(updated?.fastingValue).toBeNull();
  });

  it('returns undefined for a missing id', async () => {
    expect(
      await updateGlucoseMeasurement(db, 'nope', { ignored: true, reason: 'x' }),
    ).toBeUndefined();
  });

  it('throws if called directly with ignored: true and no reason, bypassing Zod', async () => {
    await createGlucoseMeasurement(db, 'g-4', { measuredAt, fastingValue: 90 });
    await expect(updateGlucoseMeasurement(db, 'g-4', { ignored: true })).rejects.toThrow(
      'reason is required when ignored is true',
    );
  });
});

describe('listGlucoseMeasurements / findGlucoseMeasurementById', () => {
  it('lists and finds created records', async () => {
    await createGlucoseMeasurement(db, 'g-3', { measuredAt, fastingValue: 88 });
    const rows = await listGlucoseMeasurements(db, {});
    expect(rows.map((r) => r.id)).toEqual(['g-3']);
    expect((await findGlucoseMeasurementById(db, 'g-3'))?.fastingValue).toBe(88);
  });
});
