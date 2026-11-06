import type { z } from 'zod';
import { omitUserId, type OwnerId } from '../utils/owner';
import type { HealthMonitorDb } from '../db/health-monitor/client';
import type { WeightMeasurement } from '../db/health-monitor/schema';
import {
  createWeightMeasurement as createWeightMeasurementRow,
  findWeightMeasurementById as findWeightMeasurementByIdRow,
  listWeightMeasurements as listWeightMeasurementsRow,
  updateWeightMeasurement as updateWeightMeasurementRow,
} from '../db/health-monitor/weight.repository';
import type { dateRangeQuerySchema } from '../schemas/common.schema';
import type { createWeightSchema, updateWeightSchema } from '../schemas/weight.schema';
import {
  assertReasonRequiredWhenIgnored,
  withCreateStamps,
  withUpdateStamp,
} from './health-monitor-shared';

export type WeightMeasurementView = Omit<WeightMeasurement, 'userId'>;

export async function createWeightMeasurement(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof createWeightSchema>,
  ownerId: OwnerId,
): Promise<WeightMeasurementView> {
  const row = await createWeightMeasurementRow(db, withCreateStamps(id, input, ownerId));
  return omitUserId(row);
}

export async function updateWeightMeasurement(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof updateWeightSchema>,
  ownerId: OwnerId,
): Promise<WeightMeasurementView | undefined> {
  assertReasonRequiredWhenIgnored(input);
  const row = await updateWeightMeasurementRow(db, id, withUpdateStamp(input), ownerId);
  return row && omitUserId(row);
}

export async function listWeightMeasurements(
  db: HealthMonitorDb,
  query: z.infer<typeof dateRangeQuerySchema>,
  ownerId: OwnerId,
): Promise<WeightMeasurementView[]> {
  const rows = await listWeightMeasurementsRow(db, { ...query, ownerId });
  return rows.map(omitUserId);
}

export async function findWeightMeasurementById(
  db: HealthMonitorDb,
  id: string,
  ownerId: OwnerId,
): Promise<WeightMeasurementView | undefined> {
  const row = await findWeightMeasurementByIdRow(db, id, ownerId);
  return row && omitUserId(row);
}
