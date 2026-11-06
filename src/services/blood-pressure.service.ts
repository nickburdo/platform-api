import type { z } from 'zod';
import { omitUserId, type OwnerId } from '../utils/owner';
import {
  createBloodPressureMeasurement as createBloodPressureMeasurementRow,
  findBloodPressureMeasurementById as findBloodPressureMeasurementByIdRow,
  listBloodPressureMeasurements as listBloodPressureMeasurementsRow,
  updateBloodPressureMeasurement as updateBloodPressureMeasurementRow,
} from '../db/health-monitor/blood-pressure.repository';
import type { HealthMonitorDb } from '../db/health-monitor/client';
import type { BloodPressureMeasurement } from '../db/health-monitor/schema';
import type {
  createBloodPressureSchema,
  updateBloodPressureSchema,
} from '../schemas/blood-pressure.schema';
import type { dateRangeQuerySchema } from '../schemas/common.schema';
import {
  assertReasonRequiredWhenIgnored,
  withCreateStamps,
  withUpdateStamp,
} from './health-monitor-shared';

export type BloodPressureMeasurementView = Omit<BloodPressureMeasurement, 'userId'>;

export async function createBloodPressureMeasurement(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof createBloodPressureSchema>,
  ownerId: OwnerId,
): Promise<BloodPressureMeasurementView> {
  const row = await createBloodPressureMeasurementRow(db, withCreateStamps(id, input, ownerId));
  return omitUserId(row);
}

export async function updateBloodPressureMeasurement(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof updateBloodPressureSchema>,
  ownerId: OwnerId,
): Promise<BloodPressureMeasurementView | undefined> {
  assertReasonRequiredWhenIgnored(input);
  const row = await updateBloodPressureMeasurementRow(db, id, withUpdateStamp(input), ownerId);
  return row && omitUserId(row);
}

export async function listBloodPressureMeasurements(
  db: HealthMonitorDb,
  query: z.infer<typeof dateRangeQuerySchema>,
  ownerId: OwnerId,
): Promise<BloodPressureMeasurementView[]> {
  const rows = await listBloodPressureMeasurementsRow(db, { ...query, ownerId });
  return rows.map(omitUserId);
}

export async function findBloodPressureMeasurementById(
  db: HealthMonitorDb,
  id: string,
  ownerId: OwnerId,
): Promise<BloodPressureMeasurementView | undefined> {
  const row = await findBloodPressureMeasurementByIdRow(db, id, ownerId);
  return row && omitUserId(row);
}
