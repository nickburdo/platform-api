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

export async function createWeightMeasurement(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof createWeightSchema>,
): Promise<WeightMeasurement> {
  const now = new Date().toISOString();
  return createWeightMeasurementRow(db, {
    id,
    ...input,
    isDemo: true,
    ignored: false,
    reason: '',
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateWeightMeasurement(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof updateWeightSchema>,
): Promise<WeightMeasurement | undefined> {
  return updateWeightMeasurementRow(db, id, {
    ...input,
    updatedAt: new Date().toISOString(),
  });
}

export async function listWeightMeasurements(
  db: HealthMonitorDb,
  query: z.infer<typeof dateRangeQuerySchema>,
): Promise<WeightMeasurement[]> {
  return listWeightMeasurementsRow(db, query);
}

export async function findWeightMeasurementById(
  db: HealthMonitorDb,
  id: string,
): Promise<WeightMeasurement | undefined> {
  return findWeightMeasurementByIdRow(db, id);
}
