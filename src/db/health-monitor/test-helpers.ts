import { env } from 'cloudflare:test';
import type { AnySQLiteTable } from 'drizzle-orm/sqlite-core';
import { createHealthMonitorDb, type HealthMonitorDb } from './client';

// Storage isolation is per test *file*, not per `it()` (v1-plan.md Decision
// #23) — every repo/service test needs clean table(s) before each test.
// Pass one table for a single-resource test file, or several for a
// composed one (e.g. the dashboard tests, which touch all four tables).
export async function freshHealthMonitorDb(...tables: AnySQLiteTable[]): Promise<HealthMonitorDb> {
  const db = createHealthMonitorDb(env.HEALTH_MONITOR_DB);
  await Promise.all(tables.map((table) => db.delete(table)));
  return db;
}
