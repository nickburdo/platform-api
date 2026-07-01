import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { toDateRangeBounds, type DateRangeInput } from '../../utils/date-range';
import type { HealthMonitorDb } from './client';
import { weightMeasurements, type NewWeightMeasurement, type WeightMeasurement } from './schema';

export interface ListWeightParams extends DateRangeInput {
  isDemo?: boolean;
}

function buildFilters(params: ListWeightParams) {
  const { from, to } = toDateRangeBounds(params);
  const conditions = [];
  if (from) conditions.push(gte(weightMeasurements.measuredAt, from));
  if (to) conditions.push(lte(weightMeasurements.measuredAt, to));
  if (params.isDemo !== undefined) conditions.push(eq(weightMeasurements.isDemo, params.isDemo));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listWeightMeasurements(
  db: HealthMonitorDb,
  params: ListWeightParams = {},
): Promise<WeightMeasurement[]> {
  return db
    .select()
    .from(weightMeasurements)
    .where(buildFilters(params))
    .orderBy(asc(weightMeasurements.measuredAt));
}

export async function findWeightMeasurementById(
  db: HealthMonitorDb,
  id: string,
): Promise<WeightMeasurement | undefined> {
  const [row] = await db.select().from(weightMeasurements).where(eq(weightMeasurements.id, id));
  return row;
}

export async function createWeightMeasurement(
  db: HealthMonitorDb,
  data: NewWeightMeasurement,
): Promise<WeightMeasurement> {
  const [row] = await db.insert(weightMeasurements).values(data).returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function updateWeightMeasurement(
  db: HealthMonitorDb,
  id: string,
  data: Partial<NewWeightMeasurement>,
): Promise<WeightMeasurement | undefined> {
  const [row] = await db
    .update(weightMeasurements)
    .set(data)
    .where(eq(weightMeasurements.id, id))
    .returning();
  return row;
}
