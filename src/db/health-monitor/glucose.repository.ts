import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { toDateRangeBounds, type DateRangeInput } from '../../utils/date-range';
import type { HealthMonitorDb } from './client';
import { glucoseMeasurements, type GlucoseMeasurement, type NewGlucoseMeasurement } from './schema';

export interface ListGlucoseParams extends DateRangeInput {
  isDemo?: boolean;
}

function buildFilters(params: ListGlucoseParams) {
  const { from, to } = toDateRangeBounds(params);
  const conditions = [];
  if (from) conditions.push(gte(glucoseMeasurements.measuredAt, from));
  if (to) conditions.push(lte(glucoseMeasurements.measuredAt, to));
  if (params.isDemo !== undefined) conditions.push(eq(glucoseMeasurements.isDemo, params.isDemo));
  return conditions.length > 0 ? and(...conditions) : undefined;
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
  const [row] = await db
    .update(glucoseMeasurements)
    .set(data)
    .where(eq(glucoseMeasurements.id, id))
    .returning();
  return row;
}
