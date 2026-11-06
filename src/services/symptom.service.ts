import type { z } from 'zod';
import { omitUserId, type OwnerId } from '../utils/owner';
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

export type SymptomEntryView = Omit<SymptomEntry, 'userId'>;

export async function createSymptomEntry(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof createSymptomSchema>,
  ownerId: OwnerId,
): Promise<SymptomEntryView> {
  const row = await createSymptomEntryRow(db, withCreateStamps(id, input, ownerId));
  return omitUserId(row);
}

export async function updateSymptomEntry(
  db: HealthMonitorDb,
  id: string,
  input: z.infer<typeof updateSymptomSchema>,
  ownerId: OwnerId,
): Promise<SymptomEntryView | undefined> {
  assertReasonRequiredWhenIgnored(input);
  const row = await updateSymptomEntryRow(db, id, withUpdateStamp(input), ownerId);
  return row && omitUserId(row);
}

export async function listSymptomEntries(
  db: HealthMonitorDb,
  query: z.infer<typeof dateRangeQuerySchema>,
  ownerId: OwnerId,
): Promise<SymptomEntryView[]> {
  const rows = await listSymptomEntriesRow(db, { ...query, ownerId });
  return rows.map(omitUserId);
}

export async function findSymptomEntryById(
  db: HealthMonitorDb,
  id: string,
  ownerId: OwnerId,
): Promise<SymptomEntryView | undefined> {
  const row = await findSymptomEntryByIdRow(db, id, ownerId);
  return row && omitUserId(row);
}
