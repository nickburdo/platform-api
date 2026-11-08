import { and, eq, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { ownerFilter } from '../../utils/owner';
import type { HealthMonitorDb } from './client';
import {
  bloodPressureMeasurements,
  demoRefreshState,
  glucoseMeasurements,
  symptomEntries,
  weightMeasurements,
} from './schema';

// Daily demo date shift (v4.2-plan.md Decisions 7-13, ADR-015).
//
// N = whole days elapsed between the stored refreshed_at and `now` (floor,
// via CAST of a positive julianday difference). It is computed inside every
// statement from the state row rather than passed in from JS, and every
// statement is guarded by N >= 1. The state row is updated last in the same
// batch (one D1 transaction), so a repeated or overlapping run reads the
// already advanced refreshed_at, gets N = 0 and changes nothing. Without a
// state row N is NULL, the guards are false and nothing changes.
export async function shiftDemoDates(db: HealthMonitorDb, now: Date): Promise<number> {
  const nowIso = now.toISOString();

  const elapsedDays = sql<
    number | null
  >`CAST(julianday(${nowIso}) - julianday(${demoRefreshState.refreshedAt}) AS INTEGER)`;
  const days = sql`(SELECT ${elapsedDays} FROM ${demoRefreshState} WHERE ${demoRefreshState.id} = 1)`;
  const due = sql`${days} >= 1`;

  // Same format as the API and seed.sql write (2026-11-08T12:34:56.789Z):
  // date-range filters and sorting compare these TEXT values byte-wise.
  const shifted = (column: SQLiteColumn): SQL =>
    sql`strftime('%Y-%m-%dT%H:%M:%fZ', ${column}, '+' || ${days} || ' days')`;

  const [stateRows] = await db.batch([
    db.select({ days: elapsedDays }).from(demoRefreshState).where(eq(demoRefreshState.id, 1)),
    db
      .update(glucoseMeasurements)
      .set({
        measuredAt: shifted(glucoseMeasurements.measuredAt),
        createdAt: shifted(glucoseMeasurements.createdAt),
        updatedAt: shifted(glucoseMeasurements.updatedAt),
      })
      .where(and(ownerFilter(glucoseMeasurements.userId, null), due)),
    db
      .update(bloodPressureMeasurements)
      .set({
        measuredAt: shifted(bloodPressureMeasurements.measuredAt),
        createdAt: shifted(bloodPressureMeasurements.createdAt),
        updatedAt: shifted(bloodPressureMeasurements.updatedAt),
      })
      .where(and(ownerFilter(bloodPressureMeasurements.userId, null), due)),
    db
      .update(weightMeasurements)
      .set({
        measuredAt: shifted(weightMeasurements.measuredAt),
        createdAt: shifted(weightMeasurements.createdAt),
        updatedAt: shifted(weightMeasurements.updatedAt),
      })
      .where(and(ownerFilter(weightMeasurements.userId, null), due)),
    db
      .update(symptomEntries)
      .set({
        happenedAt: shifted(symptomEntries.happenedAt),
        createdAt: shifted(symptomEntries.createdAt),
        updatedAt: shifted(symptomEntries.updatedAt),
      })
      .where(and(ownerFilter(symptomEntries.userId, null), due)),
    // Advance by exactly N days, never to `now` (Decision 8: no drift).
    db
      .update(demoRefreshState)
      .set({ refreshedAt: shifted(demoRefreshState.refreshedAt) })
      .where(and(eq(demoRefreshState.id, 1), due)),
  ]);

  const elapsed = stateRows[0]?.days ?? 0;
  return elapsed >= 1 ? elapsed : 0;
}
