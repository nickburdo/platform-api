import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../app';
import { createAuthDb } from '../db/auth/client';
import { createHealthMonitorDb } from '../db/health-monitor/client';
import { createJobTrackerDb } from '../db/job-tracker/client';

// Instantiates the Drizzle clients once per request and exposes them via
// typed `c.var` (v1-plan Decision #30). Route handlers never touch `c.env`
// directly for database access.
export const dbClients = createMiddleware<AppEnv>(async (c, next) => {
  c.set('jobTrackerDb', createJobTrackerDb(c.env.JOB_TRACKER_DB));
  c.set('healthMonitorDb', createHealthMonitorDb(c.env.HEALTH_MONITOR_DB));
  c.set('authDb', createAuthDb(c.env.AUTH_DB));
  await next();
});
