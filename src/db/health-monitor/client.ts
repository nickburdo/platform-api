import { drizzle } from 'drizzle-orm/d1';

export function createHealthMonitorDb(binding: D1Database) {
  return drizzle(binding);
}

export type HealthMonitorDb = ReturnType<typeof createHealthMonitorDb>;
