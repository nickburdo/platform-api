import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { HealthMonitorDb } from './client';
import { shiftDemoDates } from './demo-shift.repository';
import {
  bloodPressureMeasurements,
  demoRefreshState,
  glucoseMeasurements,
  symptomEntries,
  weightMeasurements,
} from './schema';
import { freshHealthMonitorDb } from './test-helpers';

const T0 = '2026-11-01T10:00:00.000Z';
const T0_PLUS_2 = '2026-11-03T10:00:00.000Z';
const ISO_FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

let db: HealthMonitorDb;

const audit = (userId: string | null) => ({
  createdAt: T0,
  updatedAt: T0,
  userId,
  ignored: false,
  reason: '',
});

async function seedRows(): Promise<void> {
  for (const [suffix, userId] of [
    ['demo', null],
    ['user', 'user-a'],
  ] as const) {
    await db.insert(glucoseMeasurements).values({
      id: `g-${suffix}`,
      measuredAt: T0,
      fastingValue: 90,
      ...audit(userId),
    });
    await db.insert(bloodPressureMeasurements).values({
      id: `bp-${suffix}`,
      measuredAt: T0,
      systolic: 120,
      diastolic: 80,
      pulse: 70,
      ...audit(userId),
    });
    await db.insert(weightMeasurements).values({
      id: `w-${suffix}`,
      measuredAt: T0,
      value: 80,
      ...audit(userId),
    });
    await db.insert(symptomEntries).values({
      id: `s-${suffix}`,
      happenedAt: T0,
      type: 'headache',
      intensity: 2,
      ...audit(userId),
    });
  }
}

// Every date column of the row with this suffix, across all four tables.
async function datesOf(suffix: 'demo' | 'user'): Promise<string[]> {
  const g = await db
    .select()
    .from(glucoseMeasurements)
    .where(eq(glucoseMeasurements.id, `g-${suffix}`));
  const bp = await db
    .select()
    .from(bloodPressureMeasurements)
    .where(eq(bloodPressureMeasurements.id, `bp-${suffix}`));
  const w = await db
    .select()
    .from(weightMeasurements)
    .where(eq(weightMeasurements.id, `w-${suffix}`));
  const s = await db
    .select()
    .from(symptomEntries)
    .where(eq(symptomEntries.id, `s-${suffix}`));
  const measurements = [one(g), one(bp), one(w)];
  const symptom = one(s);
  return [
    ...measurements.flatMap((r) => [r.measuredAt, r.createdAt, r.updatedAt]),
    symptom.happenedAt,
    symptom.createdAt,
    symptom.updatedAt,
  ];
}

function one<T>(rows: T[]): T {
  const [row] = rows;
  if (row === undefined) throw new Error('expected exactly one row');
  return row;
}

async function refreshedAt(): Promise<string | undefined> {
  const rows = await db.select().from(demoRefreshState);
  return rows[0]?.refreshedAt;
}

beforeEach(async () => {
  db = await freshHealthMonitorDb(
    glucoseMeasurements,
    bloodPressureMeasurements,
    weightMeasurements,
    symptomEntries,
    demoRefreshState,
  );
  await seedRows();
});

describe('shiftDemoDates', () => {
  it('shifts every date of demo rows in all four tables by whole days, in the exact format', async () => {
    await db.insert(demoRefreshState).values({ id: 1, refreshedAt: T0 });

    const days = await shiftDemoDates(db, new Date('2026-11-03T15:00:00.000Z'));

    expect(days).toBe(2);
    const dates = await datesOf('demo');
    expect(dates).toHaveLength(12);
    for (const date of dates) {
      expect(date).toBe(T0_PLUS_2);
      expect(date).toMatch(ISO_FORMAT);
    }
  });

  it('never changes user rows', async () => {
    await db.insert(demoRefreshState).values({ id: 1, refreshedAt: T0 });

    await shiftDemoDates(db, new Date('2026-11-03T15:00:00.000Z'));

    for (const date of await datesOf('user')) expect(date).toBe(T0);
  });

  it('changes nothing when less than 24 hours have passed', async () => {
    await db.insert(demoRefreshState).values({ id: 1, refreshedAt: T0 });

    const days = await shiftDemoDates(db, new Date('2026-11-02T09:59:59.999Z'));

    expect(days).toBe(0);
    for (const date of await datesOf('demo')) expect(date).toBe(T0);
    expect(await refreshedAt()).toBe(T0);
  });

  it('advances refreshed_at by exactly N days, not to now', async () => {
    await db.insert(demoRefreshState).values({ id: 1, refreshedAt: T0 });

    await shiftDemoDates(db, new Date('2026-11-03T15:00:00.000Z'));

    expect(await refreshedAt()).toBe(T0_PLUS_2);
  });

  it('is a no-op when called again with the same now', async () => {
    await db.insert(demoRefreshState).values({ id: 1, refreshedAt: T0 });
    const now = new Date('2026-11-03T15:00:00.000Z');
    await shiftDemoDates(db, now);

    const days = await shiftDemoDates(db, now);

    expect(days).toBe(0);
    for (const date of await datesOf('demo')) expect(date).toBe(T0_PLUS_2);
    expect(await refreshedAt()).toBe(T0_PLUS_2);
  });

  it('is a no-op without a state row', async () => {
    const days = await shiftDemoDates(db, new Date('2026-11-03T15:00:00.000Z'));

    expect(days).toBe(0);
    for (const date of await datesOf('demo')) expect(date).toBe(T0);
    expect(await refreshedAt()).toBeUndefined();
  });
});
