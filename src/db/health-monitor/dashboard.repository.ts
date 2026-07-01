import type { DateRangeInput } from '../../utils/date-range';
import { listBloodPressureMeasurements } from './blood-pressure.repository';
import type { HealthMonitorDb } from './client';
import { listGlucoseMeasurements } from './glucose.repository';
import type {
  BloodPressureMeasurement,
  GlucoseMeasurement,
  SymptomEntry,
  WeightMeasurement,
} from './schema';
import { listSymptomEntries } from './symptoms.repository';
import { listWeightMeasurements } from './weight.repository';

export interface DashboardParams extends DateRangeInput {
  isDemo?: boolean;
}

export interface DashboardData {
  glucoseMeasurements: GlucoseMeasurement[];
  bloodPressureMeasurements: BloodPressureMeasurement[];
  weightMeasurements: WeightMeasurement[];
  symptomEntries: SymptomEntry[];
}

// Composes the four Health Monitor repositories over the same date range —
// no new query logic of its own (per development.md, repositories only
// execute queries).
export async function getDashboardData(
  db: HealthMonitorDb,
  params: DashboardParams = {},
): Promise<DashboardData> {
  const [glucoseMeasurements, bloodPressureMeasurements, weightMeasurements, symptomEntries] =
    await Promise.all([
      listGlucoseMeasurements(db, params),
      listBloodPressureMeasurements(db, params),
      listWeightMeasurements(db, params),
      listSymptomEntries(db, params),
    ]);

  return { glucoseMeasurements, bloodPressureMeasurements, weightMeasurements, symptomEntries };
}
