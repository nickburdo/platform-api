import { asc, eq } from 'drizzle-orm';
import { buildDateRangeFilter, type DateRangeFilterParams } from '../../utils/repository-filters';
import type { HealthMonitorDb } from './client';
import { glucoseMeasurements, type GlucoseMeasurement, type NewGlucoseMeasurement } from './schema';

export type ListGlucoseParams = DateRangeFilterParams;

function buildFilters(params: ListGlucoseParams) {
  return buildDateRangeFilter(glucoseMeasurements.measuredAt, glucoseMeasurements.isDemo, params);
}

export async function listGlucoseMeasurements(
  db: HealthMonitorDb,
  params: ListGlucoseParams = {},
): Promise<GlucoseMeasurement[]> {
  return db
    .select()
    .from(glucoseMeasurements)
    .where(buildFilters(params))
    .orderBy(asc(glucoseMeasurements.measuredAt));
}

export async function findGlucoseMeasurementById(
  db: HealthMonitorDb,
  id: string,
): Promise<GlucoseMeasurement | undefined> {
  const [row] = await db.select().from(glucoseMeasurements).where(eq(glucoseMeasurements.id, id));
  return row;
}

export async function createGlucoseMeasurement(
  db: HealthMonitorDb,
  data: NewGlucoseMeasurement,
): Promise<GlucoseMeasurement> {
  const [row] = await db.insert(glucoseMeasurements).values(data).returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function updateGlucoseMeasurement(
  db: HealthMonitorDb,
  id: string,
  data: Partial<NewGlucoseMeasurement>,
): Promise<GlucoseMeasurement | undefined> {
  // Preserve the "exactly one of fastingValue/afterMealValue" invariant
  // (Decision #19) across partial updates: the Zod schema only validates the
  // patch body in isolation, so setting one value field here without also
  // clearing the other could otherwise leave a row with both populated if
  // the existing row already had the other one set.
  const patch = { ...data };
  if (patch.fastingValue !== undefined && patch.afterMealValue === undefined) {
    patch.afterMealValue = null;
  } else if (patch.afterMealValue !== undefined && patch.fastingValue === undefined) {
    patch.fastingValue = null;
  }

  const [row] = await db
    .update(glucoseMeasurements)
    .set(patch)
    .where(eq(glucoseMeasurements.id, id))
    .returning();
  return row;
}
