import { and, asc, eq } from 'drizzle-orm';
import { ownerFilter, type OwnerId } from '../../utils/owner';
import { buildDateRangeFilter, type DateRangeFilterParams } from '../../utils/repository-filters';
import type { HealthMonitorDb } from './client';
import { weightMeasurements, type NewWeightMeasurement, type WeightMeasurement } from './schema';

export type ListWeightParams = DateRangeFilterParams;

function buildFilters(params: ListWeightParams) {
  return buildDateRangeFilter(weightMeasurements.measuredAt, weightMeasurements.userId, params);
}

export async function listWeightMeasurements(
  db: HealthMonitorDb,
  params: ListWeightParams,
): Promise<WeightMeasurement[]> {
  return db
    .select()
    .from(weightMeasurements)
    .where(buildFilters(params))
    .orderBy(asc(weightMeasurements.measuredAt));
}

// By-id operations are scoped to the caller's owner scope (v4 Decision 1): a record outside the scope behaves as nonexistent.
export async function findWeightMeasurementById(
  db: HealthMonitorDb,
  id: string,
  ownerId: OwnerId,
): Promise<WeightMeasurement | undefined> {
  const [row] = await db
    .select()
    .from(weightMeasurements)
    .where(and(eq(weightMeasurements.id, id), ownerFilter(weightMeasurements.userId, ownerId)));
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
  ownerId: OwnerId,
): Promise<WeightMeasurement | undefined> {
  const [row] = await db
    .update(weightMeasurements)
    .set(data)
    .where(and(eq(weightMeasurements.id, id), ownerFilter(weightMeasurements.userId, ownerId)))
    .returning();
  return row;
}
