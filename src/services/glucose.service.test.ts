import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { createHealthMonitorDb, type HealthMonitorDb } from '../db/health-monitor/client';
import { glucoseMeasurements } from '../db/health-monitor/schema';
import {
  createGlucoseMeasurement,
  findGlucoseMeasurementById,
  listGlucoseMeasurements,
  updateGlucoseMeasurement,
} from './glucose.service';

let db: HealthMonitorDb;

beforeEach(async () => {
  db = createHealthMonitorDb(env.HEALTH_MONITOR_DB);
  await db.delete(glucoseMeasurements);
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
  it('bumps updatedAt and delegates the exactly-one invariant to the repository', async () => {
    await createGlucoseMeasurement(db, 'g-2', { measuredAt, afterMealValue: 120 });
    const updated = await updateGlucoseMeasurement(db, 'g-2', { fastingValue: 95 });
    expect(updated?.fastingValue).toBe(95);
    expect(updated?.afterMealValue).toBeNull();
  });

  it('returns undefined for a missing id', async () => {
    expect(
      await updateGlucoseMeasurement(db, 'nope', { ignored: true, reason: 'x' }),
    ).toBeUndefined();
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
