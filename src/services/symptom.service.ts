import type { z } from 'zod';
import type { HealthMonitorDb } from '../db/health-monitor/client';
import type { SymptomEntry } from '../db/health-monitor/schema';
import {
  createSymptomEntry as createSymptomEntryRow,
  findSymptomEntryById as findSymptomEntryByIdRow,
  listSymptomEntries as listSymptomEntriesRow,
  updateSymptomEntry as updateSymptomEntryRow,
} from '../db/health-monitor/symptoms.repository';
import type { dateRangeQuerySchema } from '../schemas/common.schema';
import type { createSymptomSchema, updateSymptomSchema } from '../schemas/symptom.schema';
import {
  assertReasonRequiredWhenIgnored,
  withCreateStamps,
  withUpdateStamp,
} from './health-monitor-shared';

export async function createSymptomEntry(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof createSymptomSchema>,
): Promise<SymptomEntry> {
  return createSymptomEntryRow(db, withCreateStamps(id, input));
}

export async function updateSymptomEntry(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof updateSymptomSchema>,
): Promise<SymptomEntry | undefined> {
  assertReasonRequiredWhenIgnored(input);
  return updateSymptomEntryRow(db, id, withUpdateStamp(input));
}

export async function listSymptomEntries(
  db: HealthMonitorDb,
  query: z.infer<typeof dateRangeQuerySchema>,
): Promise<SymptomEntry[]> {
  return listSymptomEntriesRow(db, query);
}

export async function findSymptomEntryById(
  db: HealthMonitorDb,
  id: string,
): Promise<SymptomEntry | undefined> {
  return findSymptomEntryByIdRow(db, id);
}
