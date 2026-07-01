import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { createHealthMonitorDb, type HealthMonitorDb } from './client';
import {
  createGlucoseMeasurement,
  findGlucoseMeasurementById,
  listGlucoseMeasurements,
  updateGlucoseMeasurement,
} from './glucose.repository';
import { glucoseMeasurements, type NewGlucoseMeasurement } from './schema';

let db: HealthMonitorDb;

// Storage isolation is per test *file*, not per `it()` (see v1-plan.md
// Decision #23) — clear the table before every test.
beforeEach(async () => {
  db = createHealthMonitorDb(env.HEALTH_MONITOR_DB);
  await db.delete(glucoseMeasurements);
});

function makeRow(overrides: Partial<NewGlucoseMeasurement> = {}): NewGlucoseMeasurement {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    measuredAt: '2026-06-15T08:00:00.000Z',
    fastingValue: 90,
    isDemo: true,
    ignored: false,
    reason: '',
    createdAt: '2026-06-15T08:00:00.000Z',
    updatedAt: '2026-06-15T08:00:00.000Z',
    ...overrides,
  };
}

describe('createGlucoseMeasurement / findGlucoseMeasurementById', () => {
  it('creates a row and finds it by id', async () => {
    const created = await createGlucoseMeasurement(db, makeRow({ id: 'g-1', fastingValue: 91 }));
    expect(created.fastingValue).toBe(91);

    const found = await findGlucoseMeasurementById(db, 'g-1');
    expect(found?.fastingValue).toBe(91);
  });
});

describe('updateGlucoseMeasurement', () => {
  it('sets ignored/reason without touching measurement fields', async () => {
    await createGlucoseMeasurement(db, makeRow({ id: 'g-2' }));
    const updated = await updateGlucoseMeasurement(db, 'g-2', {
      ignored: true,
      reason: 'Incorrect reading',
    });
    expect(updated?.ignored).toBe(true);
    expect(updated?.reason).toBe('Incorrect reading');
    expect(updated?.fastingValue).toBe(90);
  });
});

describe('listGlucoseMeasurements', () => {
  beforeEach(async () => {
    await Promise.all([
      createGlucoseMeasurement(
        db,
        makeRow({ id: 'd-1', measuredAt: '2026-06-01T08:00:00.000Z', isDemo: true }),
      ),
      createGlucoseMeasurement(
        db,
        makeRow({ id: 'd-2', measuredAt: '2026-06-15T08:00:00.000Z', isDemo: true }),
      ),
      createGlucoseMeasurement(
        db,
        makeRow({ id: 'd-3', measuredAt: '2026-06-30T23:30:00.000Z', isDemo: false }),
      ),
    ]);
  });

  it('returns all rows ordered by measuredAt ascending when unfiltered', async () => {
    const rows = await listGlucoseMeasurements(db);
    expect(rows.map((r) => r.id)).toEqual(['d-1', 'd-2', 'd-3']);
  });

  it('filters by date_from/date_to inclusively', async () => {
    const rows = await listGlucoseMeasurements(db, {
      date_from: '2026-06-01',
      date_to: '2026-06-15',
    });
    expect(rows.map((r) => r.id)).toEqual(['d-1', 'd-2']);
  });

  it('includes a record at 23:30 on date_to — end-of-day widening (Decision #21)', async () => {
    const rows = await listGlucoseMeasurements(db, { date_to: '2026-06-30' });
    expect(rows.map((r) => r.id)).toContain('d-3');
  });

  it('excludes a record dated the day after date_to', async () => {
    const rows = await listGlucoseMeasurements(db, { date_to: '2026-06-29' });
    expect(rows.map((r) => r.id)).not.toContain('d-3');
  });

  it('filters by isDemo', async () => {
    const rows = await listGlucoseMeasurements(db, { isDemo: false });
    expect(rows.map((r) => r.id)).toEqual(['d-3']);
  });
});
