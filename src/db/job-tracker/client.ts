import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function createJobTrackerDb(binding: D1Database) {
  return drizzle(binding, { schema });
}

export type JobTrackerDb = ReturnType<typeof createJobTrackerDb>;
