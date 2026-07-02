import { and, asc, eq } from 'drizzle-orm';
import { buildDateRangeFilter, type DateRangeFilterParams } from '../../utils/repository-filters';
import type { HealthMonitorDb } from './client';
import { symptomEntries, type NewSymptomEntry, type SymptomEntry } from './schema';

export type ListSymptomsParams = DateRangeFilterParams;

function buildFilters(params: ListSymptomsParams) {
  return buildDateRangeFilter(symptomEntries.happenedAt, symptomEntries.isDemo, params);
}

export async function listSymptomEntries(
  db: HealthMonitorDb,
  params: ListSymptomsParams = {},
): Promise<SymptomEntry[]> {
  return db
    .select()
    .from(symptomEntries)
    .where(buildFilters(params))
    .orderBy(asc(symptomEntries.happenedAt));
}

// By-id operations are scoped to the caller's isDemo world (v2-plan.md
// Decision #11): a record outside the scope behaves as nonexistent.
export async function findSymptomEntryById(
  db: HealthMonitorDb,
  id: string,
  isDemo: boolean,
): Promise<SymptomEntry | undefined> {
  const [row] = await db
    .select()
    .from(symptomEntries)
    .where(and(eq(symptomEntries.id, id), eq(symptomEntries.isDemo, isDemo)));
  return row;
}

export async function createSymptomEntry(
  db: HealthMonitorDb,
  data: NewSymptomEntry,
): Promise<SymptomEntry> {
  const [row] = await db.insert(symptomEntries).values(data).returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function updateSymptomEntry(
  db: HealthMonitorDb,
  id: string,
  data: Partial<NewSymptomEntry>,
  isDemo: boolean,
): Promise<SymptomEntry | undefined> {
  const [row] = await db
    .update(symptomEntries)
    .set(data)
    .where(and(eq(symptomEntries.id, id), eq(symptomEntries.isDemo, isDemo)))
    .returning();
  return row;
}
