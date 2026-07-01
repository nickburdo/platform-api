import type { z } from 'zod';
import type { HealthMonitorDb } from '../db/health-monitor/client';
import {
  createGlucoseMeasurement as createGlucoseMeasurementRow,
  findGlucoseMeasurementById as findGlucoseMeasurementByIdRow,
  listGlucoseMeasurements as listGlucoseMeasurementsRow,
  updateGlucoseMeasurement as updateGlucoseMeasurementRow,
} from '../db/health-monitor/glucose.repository';
import type { GlucoseMeasurement, NewGlucoseMeasurement } from '../db/health-monitor/schema';
import type { dateRangeQuerySchema } from '../schemas/common.schema';
import type { createGlucoseSchema, updateGlucoseSchema } from '../schemas/glucose.schema';
import {
  assertReasonRequiredWhenIgnored,
  withCreateStamps,
  withUpdateStamp,
} from './health-monitor-shared';

export async function createGlucoseMeasurement(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof createGlucoseSchema>,
): Promise<GlucoseMeasurement> {
  return createGlucoseMeasurementRow(db, withCreateStamps(id, input));
}

export async function updateGlucoseMeasurement(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof updateGlucoseSchema>,
): Promise<GlucoseMeasurement | undefined> {
  assertReasonRequiredWhenIgnored(input);

  // Preserve the "exactly one of fastingValue/afterMealValue" invariant
  // (Decision #19) across partial updates: the Zod schema only validates the
  // patch body in isolation, so setting one value field here without also
  // clearing the other could otherwise leave a row with both populated if
  // the existing row already had the other one set. This is business logic
  // (development.md), so it lives here, not in glucose.repository.ts.
  const patch: Partial<NewGlucoseMeasurement> = { ...input };
  if (patch.fastingValue !== undefined && patch.afterMealValue === undefined) {
    patch.afterMealValue = null;
  } else if (patch.afterMealValue !== undefined && patch.fastingValue === undefined) {
    patch.fastingValue = null;
  }

  return updateGlucoseMeasurementRow(db, id, withUpdateStamp(patch));
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
