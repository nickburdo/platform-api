import { env } from 'cloudflare:test';
import { createJobTrackerDb, type JobTrackerDb } from './client';
import { jobApplications } from './schema';

// Storage isolation is per test *file*, not per `it()` (v1-plan.md Decision
// #23) — every repo/service test needs a clean table before each test.
export async function freshJobTrackerDb(): Promise<JobTrackerDb> {
  const db = createJobTrackerDb(env.JOB_TRACKER_DB);
  await db.delete(jobApplications);
  return db;
}
