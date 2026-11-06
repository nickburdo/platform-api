import type { z } from 'zod';
import type { HealthMonitorDb } from '../db/health-monitor/client';
import { getDashboardData as getDashboardDataRow } from '../db/health-monitor/dashboard.repository';
import type { BloodPressureMeasurementView } from './blood-pressure.service';
import type { GlucoseMeasurementView } from './glucose.service';
import type { SymptomEntryView } from './symptom.service';
import type { WeightMeasurementView } from './weight.service';
import type { dateRangeQuerySchema } from '../schemas/common.schema';
import { omitUserId, type OwnerId } from '../utils/owner';

export interface DashboardView {
  glucoseMeasurements: GlucoseMeasurementView[];
  bloodPressureMeasurements: BloodPressureMeasurementView[];
  weightMeasurements: WeightMeasurementView[];
  symptomEntries: SymptomEntryView[];
}

// Delegates to dashboard.repository.ts's composition of the four Health
// Monitor repositories and strips userId from every row of every array.
//
// `ownerId` is a separate parameter, not a field on `dateRangeQuerySchema`:
// it is never client-supplied (it comes from the identity), so it does not
// belong in the schema that validates raw HTTP query params.
export async function getDashboardData(
  db: HealthMonitorDb,
  query: z.infer<typeof dateRangeQuerySchema>,
  ownerId: OwnerId,
): Promise<DashboardView> {
  const data = await getDashboardDataRow(db, { ...query, ownerId });
  return {
    glucoseMeasurements: data.glucoseMeasurements.map(omitUserId),
    bloodPressureMeasurements: data.bloodPressureMeasurements.map(omitUserId),
    weightMeasurements: data.weightMeasurements.map(omitUserId),
    symptomEntries: data.symptomEntries.map(omitUserId),
  };
}
