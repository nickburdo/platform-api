import { eq } from 'drizzle-orm';
import type { HealthMonitorDb } from './client';
import {
  bloodPressureMeasurements,
  glucoseMeasurements,
  symptomEntries,
  weightMeasurements,
} from './schema';

// Account deletion (v4 Decision 16). userId is always a real user id, so demo
// rows (user_id IS NULL) can never match. One batch = one atomic transaction.
export async function deleteHealthDataByUserId(db: HealthMonitorDb, userId: string): Promise<void> {
  await db.batch([
    db.delete(glucoseMeasurements).where(eq(glucoseMeasurements.userId, userId)),
    db.delete(bloodPressureMeasurements).where(eq(bloodPressureMeasurements.userId, userId)),
    db.delete(weightMeasurements).where(eq(weightMeasurements.userId, userId)),
    db.delete(symptomEntries).where(eq(symptomEntries.userId, userId)),
  ]);
}
