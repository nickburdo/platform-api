import { and, eq, gte, lte, type Column, type SQL } from 'drizzle-orm';
import { toDateRangeBounds, type DateRangeInput } from './date-range';

export interface DateRangeFilterParams extends DateRangeInput {
  isDemo?: boolean;
}

// Shared by all four Health Monitor repositories (glucose, blood-pressure,
// weight, symptoms) — the only thing that varies between them is which date
// column and isDemo column belong to which table.
export function buildDateRangeFilter(
  dateColumn: Column,
  isDemoColumn: Column,
  params: DateRangeFilterParams,
): SQL | undefined {
  const { from, to } = toDateRangeBounds(params);
  const conditions: SQL[] = [];
  if (from) conditions.push(gte(dateColumn, from));
  if (to) conditions.push(lte(dateColumn, to));
  if (params.isDemo !== undefined) conditions.push(eq(isDemoColumn, params.isDemo));
  return conditions.length > 0 ? and(...conditions) : undefined;
}
