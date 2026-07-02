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
  isDemo: boolean,
): Promise<SymptomEntry> {
  return createSymptomEntryRow(db, withCreateStamps(id, input, isDemo));
}

export async function updateSymptomEntry(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof updateSymptomSchema>,
  isDemo: boolean,
): Promise<SymptomEntry | undefined> {
  assertReasonRequiredWhenIgnored(input);
  return updateSymptomEntryRow(db, id, withUpdateStamp(input), isDemo);
}

export async function listSymptomEntries(
  db: HealthMonitorDb,
  query: z.infer<typeof dateRangeQuerySchema>,
  isDemo: boolean,
): Promise<SymptomEntry[]> {
  return listSymptomEntriesRow(db, { ...query, isDemo });
}

export async function findSymptomEntryById(
  db: HealthMonitorDb,
  id: string,
  isDemo: boolean,
): Promise<SymptomEntry | undefined> {
  return findSymptomEntryByIdRow(db, id, isDemo);
}
