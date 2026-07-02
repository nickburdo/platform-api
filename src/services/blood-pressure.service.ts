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
import {
  assertReasonRequiredWhenIgnored,
  withCreateStamps,
  withUpdateStamp,
} from './health-monitor-shared';

export async function createBloodPressureMeasurement(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof createBloodPressureSchema>,
  isDemo: boolean,
): Promise<BloodPressureMeasurement> {
  return createBloodPressureMeasurementRow(db, withCreateStamps(id, input, isDemo));
}

export async function updateBloodPressureMeasurement(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof updateBloodPressureSchema>,
  isDemo: boolean,
): Promise<BloodPressureMeasurement | undefined> {
  assertReasonRequiredWhenIgnored(input);
  return updateBloodPressureMeasurementRow(db, id, withUpdateStamp(input), isDemo);
}

export async function listBloodPressureMeasurements(
  db: HealthMonitorDb,
  query: z.infer<typeof dateRangeQuerySchema>,
  isDemo: boolean,
): Promise<BloodPressureMeasurement[]> {
  return listBloodPressureMeasurementsRow(db, { ...query, isDemo });
}

export async function findBloodPressureMeasurementById(
  db: HealthMonitorDb,
  id: string,
  isDemo: boolean,
): Promise<BloodPressureMeasurement | undefined> {
  return findBloodPressureMeasurementByIdRow(db, id, isDemo);
}
