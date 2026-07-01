import type { z } from 'zod';
import type { HealthMonitorDb } from '../db/health-monitor/client';
import {
  createGlucoseMeasurement as createGlucoseMeasurementRow,
  findGlucoseMeasurementById as findGlucoseMeasurementByIdRow,
  listGlucoseMeasurements as listGlucoseMeasurementsRow,
  updateGlucoseMeasurement as updateGlucoseMeasurementRow,
} from '../db/health-monitor/glucose.repository';
import type { GlucoseMeasurement } from '../db/health-monitor/schema';
import type { dateRangeQuerySchema } from '../schemas/common.schema';
import type { createGlucoseSchema, updateGlucoseSchema } from '../schemas/glucose.schema';

export async function createGlucoseMeasurement(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof createGlucoseSchema>,
): Promise<GlucoseMeasurement> {
  const now = new Date().toISOString();
  return createGlucoseMeasurementRow(db, {
    id,
    ...input,
    isDemo: true,
    ignored: false,
    reason: '',
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateGlucoseMeasurement(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof updateGlucoseSchema>,
): Promise<GlucoseMeasurement | undefined> {
  return updateGlucoseMeasurementRow(db, id, {
    ...input,
    updatedAt: new Date().toISOString(),
  });
}

export async function listGlucoseMeasurements(
  db: HealthMonitorDb,
  query: z.infer<typeof dateRangeQuerySchema>,
): Promise<GlucoseMeasurement[]> {
  return listGlucoseMeasurementsRow(db, query);
}

export async function findGlucoseMeasurementById(
  db: HealthMonitorDb,
  id: string,
): Promise<GlucoseMeasurement | undefined> {
  return findGlucoseMeasurementByIdRow(db, id);
}
