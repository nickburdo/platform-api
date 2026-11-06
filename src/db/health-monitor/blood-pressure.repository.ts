import { and, asc, eq } from 'drizzle-orm';
import { ownerFilter, type OwnerId } from '../../utils/owner';
import { buildDateRangeFilter, type DateRangeFilterParams } from '../../utils/repository-filters';
import type { HealthMonitorDb } from './client';
import {
  bloodPressureMeasurements,
  type BloodPressureMeasurement,
  type NewBloodPressureMeasurement,
} from './schema';

export type ListBloodPressureParams = DateRangeFilterParams;

function buildFilters(params: ListBloodPressureParams) {
  return buildDateRangeFilter(
    bloodPressureMeasurements.measuredAt,
    bloodPressureMeasurements.userId,
    params,
  );
}

export async function listBloodPressureMeasurements(
  db: HealthMonitorDb,
  params: ListBloodPressureParams,
): Promise<BloodPressureMeasurement[]> {
  return db
    .select()
    .from(bloodPressureMeasurements)
    .where(buildFilters(params))
    .orderBy(asc(bloodPressureMeasurements.measuredAt));
}

// By-id operations are scoped to the caller's owner scope (v4 Decision 1): a record outside the scope behaves as nonexistent.
export async function findBloodPressureMeasurementById(
  db: HealthMonitorDb,
  id: string,
  ownerId: OwnerId,
): Promise<BloodPressureMeasurement | undefined> {
  const [row] = await db
    .select()
    .from(bloodPressureMeasurements)
    .where(
      and(
        eq(bloodPressureMeasurements.id, id),
        ownerFilter(bloodPressureMeasurements.userId, ownerId),
      ),
    );
  return row;
}

export async function createBloodPressureMeasurement(
  db: HealthMonitorDb,
  data: NewBloodPressureMeasurement,
): Promise<BloodPressureMeasurement> {
  const [row] = await db.insert(bloodPressureMeasurements).values(data).returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function updateBloodPressureMeasurement(
  db: HealthMonitorDb,
  id: string,
  data: Partial<NewBloodPressureMeasurement>,
  ownerId: OwnerId,
): Promise<BloodPressureMeasurement | undefined> {
  const [row] = await db
    .update(bloodPressureMeasurements)
    .set(data)
    .where(
      and(
        eq(bloodPressureMeasurements.id, id),
        ownerFilter(bloodPressureMeasurements.userId, ownerId),
      ),
    )
    .returning();
  return row;
}
