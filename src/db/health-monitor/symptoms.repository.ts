import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { toDateRangeBounds, type DateRangeInput } from '../../utils/date-range';
import type { HealthMonitorDb } from './client';
import { symptomEntries, type NewSymptomEntry, type SymptomEntry } from './schema';

export interface ListSymptomsParams extends DateRangeInput {
  isDemo?: boolean;
}

function buildFilters(params: ListSymptomsParams) {
  const { from, to } = toDateRangeBounds(params);
  const conditions = [];
  if (from) conditions.push(gte(symptomEntries.happenedAt, from));
  if (to) conditions.push(lte(symptomEntries.happenedAt, to));
  if (params.isDemo !== undefined) conditions.push(eq(symptomEntries.isDemo, params.isDemo));
  return conditions.length > 0 ? and(...conditions) : undefined;
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

export async function findSymptomEntryById(
  db: HealthMonitorDb,
  id: string,
): Promise<SymptomEntry | undefined> {
  const [row] = await db.select().from(symptomEntries).where(eq(symptomEntries.id, id));
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
): Promise<SymptomEntry | undefined> {
  const [row] = await db
    .update(symptomEntries)
    .set(data)
    .where(eq(symptomEntries.id, id))
    .returning();
  return row;
}
