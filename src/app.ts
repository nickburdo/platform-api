import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { HealthMonitorDb } from './db/health-monitor/client';
import type { JobTrackerDb } from './db/job-tracker/client';
import { dbClients } from './middleware/db';
import { handleError, handleNotFound } from './middleware/error';
import { requestLogger } from './middleware/logging';
import { bloodPressureRoutes } from './routes/blood-pressure.routes';
import { dashboardRoutes } from './routes/dashboard.routes';
import { glucoseRoutes } from './routes/glucose.routes';
import { healthRoutes } from './routes/health.routes';
import { jobsRoutes } from './routes/jobs.routes';
import { symptomsRoutes } from './routes/symptoms.routes';
import { weightRoutes } from './routes/weight.routes';

export type Bindings = {
  JOB_TRACKER_DB: D1Database;
  HEALTH_MONITOR_DB: D1Database;
};

export type Variables = {
  jobTrackerDb: JobTrackerDb;
  healthMonitorDb: HealthMonitorDb;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

const app = new Hono<AppEnv>();

// Registration order per v1-plan.md Section 8: CORS (answers preflights
// before anything else runs) → logger → db-inject → routers. CORS uses
// hono/cors defaults — Access-Control-Allow-Origin: * (Decision #8).
app.use('*', cors());
app.use('*', requestLogger);
app.use('*', dbClients);

app.onError(handleError);
app.notFound(handleNotFound);

app.route('/health', healthRoutes);
app.route('/jobs', jobsRoutes);
app.route('/glucose', glucoseRoutes);
app.route('/blood-pressure', bloodPressureRoutes);
app.route('/weight', weightRoutes);
app.route('/symptoms', symptomsRoutes);
app.route('/dashboard', dashboardRoutes);

export default app;
