import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { toDateRangeBounds, type DateRangeInput } from '../../utils/date-range';
import type { HealthMonitorDb } from './client';
import {
  bloodPressureMeasurements,
  type BloodPressureMeasurement,
  type NewBloodPressureMeasurement,
} from './schema';

export interface ListBloodPressureParams extends DateRangeInput {
  isDemo?: boolean;
}

function buildFilters(params: ListBloodPressureParams) {
  const { from, to } = toDateRangeBounds(params);
  const conditions = [];
  if (from) conditions.push(gte(bloodPressureMeasurements.measuredAt, from));
  if (to) conditions.push(lte(bloodPressureMeasurements.measuredAt, to));
  if (params.isDemo !== undefined) {
    conditions.push(eq(bloodPressureMeasurements.isDemo, params.isDemo));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
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
