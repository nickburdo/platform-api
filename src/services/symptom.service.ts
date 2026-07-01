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

export async function createSymptomEntry(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof createSymptomSchema>,
): Promise<SymptomEntry> {
  const now = new Date().toISOString();
  return createSymptomEntryRow(db, {
    id,
    ...input,
    isDemo: true,
    ignored: false,
    reason: '',
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateSymptomEntry(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof updateSymptomSchema>,
): Promise<SymptomEntry | undefined> {
  return updateSymptomEntryRow(db, id, {
    ...input,
    updatedAt: new Date().toISOString(),
  });
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
