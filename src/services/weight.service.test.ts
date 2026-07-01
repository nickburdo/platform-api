import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { createHealthMonitorDb, type HealthMonitorDb } from '../db/health-monitor/client';
import { weightMeasurements } from '../db/health-monitor/schema';
import {
  createWeightMeasurement,
  findWeightMeasurementById,
  listWeightMeasurements,
  updateWeightMeasurement,
} from './weight.service';

let db: HealthMonitorDb;

beforeEach(async () => {
  db = createHealthMonitorDb(env.HEALTH_MONITOR_DB);
  await db.delete(weightMeasurements);
});

const measuredAt = '2026-06-15T08:00:00.000Z';

describe('createWeightMeasurement', () => {
  it('sets isDemo: true, ignored: false, reason: "", and stamps timestamps', async () => {
    const created = await createWeightMeasurement(db, 'w-1', { measuredAt, value: 84.6 });
    expect(created.isDemo).toBe(true);
    expect(created.ignored).toBe(false);
    expect(created.reason).toBe('');
    expect(created.createdAt).toBe(created.updatedAt);
  });
});

describe('updateWeightMeasurement', () => {
  it('returns undefined for a missing id', async () => {
    expect(
      await updateWeightMeasurement(db, 'nope', { ignored: true, reason: 'x' }),
    ).toBeUndefined();
  });
});

describe('listWeightMeasurements / findWeightMeasurementById', () => {
  it('lists and finds created records', async () => {
    await createWeightMeasurement(db, 'w-2', { measuredAt, value: 85.0 });
    const rows = await listWeightMeasurements(db, {});
    expect(rows.map((r) => r.id)).toEqual(['w-2']);
    expect((await findWeightMeasurementById(db, 'w-2'))?.value).toBe(85.0);
  });
});
