import { beforeEach, describe, expect, it } from 'vitest';
import type { HealthMonitorDb } from './client';
import {
  createGlucoseMeasurement,
  findGlucoseMeasurementById,
  listGlucoseMeasurements,
  updateGlucoseMeasurement,
} from './glucose.repository';
import { glucoseMeasurements, type NewGlucoseMeasurement } from './schema';
import { freshHealthMonitorDb } from './test-helpers';

let db: HealthMonitorDb;

beforeEach(async () => {
  db = await freshHealthMonitorDb(glucoseMeasurements);
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

    const found = await findGlucoseMeasurementById(db, 'g-1', true);
    expect(found?.fastingValue).toBe(91);
  });

  it('returns undefined when the id exists but outside the requested isDemo scope', async () => {
    await createGlucoseMeasurement(db, makeRow({ id: 'g-1b', isDemo: false }));
    expect(await findGlucoseMeasurementById(db, 'g-1b', true)).toBeUndefined();
    expect((await findGlucoseMeasurementById(db, 'g-1b', false))?.id).toBe('g-1b');
  });
});

describe('updateGlucoseMeasurement', () => {
  it('sets ignored/reason without touching measurement fields', async () => {
    await createGlucoseMeasurement(db, makeRow({ id: 'g-2' }));
    const updated = await updateGlucoseMeasurement(
      db,
      'g-2',
      { ignored: true, reason: 'Incorrect reading' },
      true,
    );
    expect(updated?.ignored).toBe(true);
    expect(updated?.reason).toBe('Incorrect reading');
    expect(updated?.fastingValue).toBe(90);
  });

  // The "exactly one of fastingValue/afterMealValue" invariant used to be
  // enforced here, but it's business logic (Decision #19) and now lives in
  // glucose.service.ts instead — see glucose.service.test.ts. This repository
  // function is a plain passthrough, matching the other three Health Monitor
  // repositories.
  it('is a plain passthrough that does not null out the other value field itself', async () => {
    await createGlucoseMeasurement(
      db,
      makeRow({ id: 'g-3', fastingValue: null, afterMealValue: 130 }),
    );
    const updated = await updateGlucoseMeasurement(db, 'g-3', { fastingValue: 95 }, true);
    expect(updated?.fastingValue).toBe(95);
    expect(updated?.afterMealValue).toBe(130);
  });

  it('returns undefined when the id exists but outside the requested isDemo scope', async () => {
    await createGlucoseMeasurement(db, makeRow({ id: 'g-2b', isDemo: false }));
    expect(await updateGlucoseMeasurement(db, 'g-2b', { fastingValue: 95 }, true)).toBeUndefined();
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
