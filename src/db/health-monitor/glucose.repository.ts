import { and, asc, eq } from 'drizzle-orm';
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

// By-id operations are scoped to the caller's isDemo world (v2-plan.md
// Decision #11): a record outside the scope behaves as nonexistent.
export async function findGlucoseMeasurementById(
  db: HealthMonitorDb,
  id: string,
  isDemo: boolean,
): Promise<GlucoseMeasurement | undefined> {
  const [row] = await db
    .select()
    .from(glucoseMeasurements)
    .where(and(eq(glucoseMeasurements.id, id), eq(glucoseMeasurements.isDemo, isDemo)));
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

// Preserving the "exactly one of fastingValue/afterMealValue" invariant
// (Decision #19) across partial updates is business logic, not a query
// concern — it lives in glucose.service.ts, not here (per development.md:
// "Repositories should not contain business rules... only execute queries").
export async function updateGlucoseMeasurement(
  db: HealthMonitorDb,
  id: string,
  data: Partial<NewGlucoseMeasurement>,
  isDemo: boolean,
): Promise<GlucoseMeasurement | undefined> {
  const [row] = await db
    .update(glucoseMeasurements)
    .set(data)
    .where(and(eq(glucoseMeasurements.id, id), eq(glucoseMeasurements.isDemo, isDemo)))
    .returning();
  return row;
}
