import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function createHealthMonitorDb(binding: D1Database) {
  return drizzle(binding, { schema });
}

export type HealthMonitorDb = ReturnType<typeof createHealthMonitorDb>;
