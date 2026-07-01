import { drizzle } from 'drizzle-orm/d1';

export function createJobTrackerDb(binding: D1Database) {
  return drizzle(binding);
}

export type JobTrackerDb = ReturnType<typeof createJobTrackerDb>;
