import type { z } from 'zod';
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

export async function createWeightMeasurement(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof createWeightSchema>,
  isDemo: boolean,
): Promise<WeightMeasurement> {
  return createWeightMeasurementRow(db, withCreateStamps(id, input, isDemo));
}

export async function updateWeightMeasurement(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof updateWeightSchema>,
  isDemo: boolean,
): Promise<WeightMeasurement | undefined> {
  assertReasonRequiredWhenIgnored(input);
  return updateWeightMeasurementRow(db, id, withUpdateStamp(input), isDemo);
}

export async function listWeightMeasurements(
  db: HealthMonitorDb,
  query: z.infer<typeof dateRangeQuerySchema>,
  isDemo: boolean,
): Promise<WeightMeasurement[]> {
  return listWeightMeasurementsRow(db, { ...query, isDemo });
}

export async function findWeightMeasurementById(
  db: HealthMonitorDb,
  id: string,
  isDemo: boolean,
): Promise<WeightMeasurement | undefined> {
  return findWeightMeasurementByIdRow(db, id, isDemo);
}
