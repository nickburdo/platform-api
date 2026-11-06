import { and, gte, lte, type Column, type SQL } from 'drizzle-orm';
import { toDateRangeBounds, type DateRangeInput } from './date-range';
import { ownerFilter, type OwnerId } from './owner';

export type DateRangeFilterParams = DateRangeInput & { ownerId: OwnerId };

// Shared by all four Health Monitor repositories (glucose, blood-pressure,
// weight, symptoms) — the only thing that varies between them is which date
// column and user_id column belong to which table. The owner condition is
// always present, so a query can never run unscoped.
export function buildDateRangeFilter(
  dateColumn: Column,
  userIdColumn: Column,
  params: DateRangeFilterParams,
): SQL | undefined {
  const { from, to } = toDateRangeBounds(params);
  const conditions: SQL[] = [ownerFilter(userIdColumn, params.ownerId)];
  if (from) conditions.push(gte(dateColumn, from));
  if (to) conditions.push(lte(dateColumn, to));
  return and(...conditions);
}
