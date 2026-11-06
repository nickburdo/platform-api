import type { z } from 'zod';
import { omitUserId, type OwnerId } from '../utils/owner';
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

export type GlucoseMeasurementView = Omit<GlucoseMeasurement, 'userId'>;

export async function createGlucoseMeasurement(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof createGlucoseSchema>,
  ownerId: OwnerId,
): Promise<GlucoseMeasurementView> {
  const row = await createGlucoseMeasurementRow(db, withCreateStamps(id, input, ownerId));
  return omitUserId(row);
}

export async function updateGlucoseMeasurement(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof updateGlucoseSchema>,
  ownerId: OwnerId,
): Promise<GlucoseMeasurementView | undefined> {
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

  const row = await updateGlucoseMeasurementRow(db, id, withUpdateStamp(patch), ownerId);
  return row && omitUserId(row);
}

export async function listGlucoseMeasurements(
  db: HealthMonitorDb,
  query: z.infer<typeof dateRangeQuerySchema>,
  ownerId: OwnerId,
): Promise<GlucoseMeasurementView[]> {
  const rows = await listGlucoseMeasurementsRow(db, { ...query, ownerId });
  return rows.map(omitUserId);
}

export async function findGlucoseMeasurementById(
  db: HealthMonitorDb,
  id: string,
  ownerId: OwnerId,
): Promise<GlucoseMeasurementView | undefined> {
  const row = await findGlucoseMeasurementByIdRow(db, id, ownerId);
  return row && omitUserId(row);
}
