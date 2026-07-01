import { asc, eq } from 'drizzle-orm';
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
    bloodPressureMeasurements.isDemo,
    params,
  );
}

export async function listBloodPressureMeasurements(
  db: HealthMonitorDb,
  params: ListBloodPressureParams = {},
): Promise<BloodPressureMeasurement[]> {
  return db
    .select()
    .from(bloodPressureMeasurements)
    .where(buildFilters(params))
    .orderBy(asc(bloodPressureMeasurements.measuredAt));
}

export async function findBloodPressureMeasurementById(
  db: HealthMonitorDb,
  id: string,
): Promise<BloodPressureMeasurement | undefined> {
  const [row] = await db
    .select()
    .from(bloodPressureMeasurements)
    .where(eq(bloodPressureMeasurements.id, id));
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
): Promise<BloodPressureMeasurement | undefined> {
  const [row] = await db
    .update(bloodPressureMeasurements)
    .set(data)
    .where(eq(bloodPressureMeasurements.id, id))
    .returning();
  return row;
}
