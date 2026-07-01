import type { z } from 'zod';
import type { HealthMonitorDb } from '../db/health-monitor/client';
import { getDashboardData as getDashboardDataRow } from '../db/health-monitor/dashboard.repository';
import type { DashboardData } from '../db/health-monitor/dashboard.repository';
import type { dateRangeQuerySchema } from '../schemas/common.schema';

// Delegates straight to dashboard.repository.ts's existing composition of
// the four Health Monitor repositories, rather than composing the four
// sibling services — those services add no read-time transformation over
// their repositories in V1 (no isDemo scoping happens yet, per Decision
// #10), so recomposing through them here would be a redundant extra layer
// with identical behavior.
//
// `isDemo` is a separate parameter, not a field on `dateRangeQuerySchema`:
// it's never client-supplied (the server assigns it, e.g. from auth context
// once V2 lands), so it doesn't belong in the schema that validates raw HTTP
// query params — only in this internal service-level parameter.
export async function getDashboardData(
  db: HealthMonitorDb,
  query: z.infer<typeof dateRangeQuerySchema> & { isDemo?: boolean },
): Promise<DashboardData> {
  return getDashboardDataRow(db, query);
}
