import type { z } from 'zod';
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

export async function createBloodPressureMeasurement(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof createBloodPressureSchema>,
): Promise<BloodPressureMeasurement> {
  const now = new Date().toISOString();
  return createBloodPressureMeasurementRow(db, {
    id,
    ...input,
    isDemo: true,
    ignored: false,
    reason: '',
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateBloodPressureMeasurement(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof updateBloodPressureSchema>,
): Promise<BloodPressureMeasurement | undefined> {
  return updateBloodPressureMeasurementRow(db, id, {
    ...input,
    updatedAt: new Date().toISOString(),
  });
}

export async function listBloodPressureMeasurements(
  db: HealthMonitorDb,
  query: z.infer<typeof dateRangeQuerySchema>,
): Promise<BloodPressureMeasurement[]> {
  return listBloodPressureMeasurementsRow(db, query);
}

export async function findBloodPressureMeasurementById(
  db: HealthMonitorDb,
  id: string,
): Promise<BloodPressureMeasurement | undefined> {
  return findBloodPressureMeasurementByIdRow(db, id);
}
