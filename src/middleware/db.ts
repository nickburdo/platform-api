import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../app';
import { createHealthMonitorDb } from '../db/health-monitor/client';
import { createJobTrackerDb } from '../db/job-tracker/client';

// Instantiates both Drizzle clients once per request and exposes them via
// typed `c.var` (Decision #30). Route handlers never touch `c.env` directly —
// this is the single place to evolve when V2 introduces auth-scoped access.
export const dbClients = createMiddleware<AppEnv>(async (c, next) => {
  c.set('jobTrackerDb', createJobTrackerDb(c.env.JOB_TRACKER_DB));
  c.set('healthMonitorDb', createHealthMonitorDb(c.env.HEALTH_MONITOR_DB));
  await next();
});
