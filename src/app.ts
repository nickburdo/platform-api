import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AuthDb } from './db/auth/client';
import type { HealthMonitorDb } from './db/health-monitor/client';
import type { JobTrackerDb } from './db/job-tracker/client';
import { resolveIdentity, type Identity } from './middleware/auth';
import { dbClients } from './middleware/db';
import { handleError, handleNotFound } from './middleware/error';
import { requestLogger } from './middleware/logging';
import { authRoutes } from './routes/auth.routes';
import { bloodPressureRoutes } from './routes/blood-pressure.routes';
import { dashboardRoutes } from './routes/dashboard.routes';
import { docsRoutes } from './routes/docs.routes';
import { glucoseRoutes } from './routes/glucose.routes';
import { healthRoutes } from './routes/health.routes';
import { jobsRoutes } from './routes/jobs.routes';
import { symptomsRoutes } from './routes/symptoms.routes';
import { weightRoutes } from './routes/weight.routes';

export type Bindings = {
  JOB_TRACKER_DB: D1Database;
  HEALTH_MONITOR_DB: D1Database;
  AUTH_DB: D1Database;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
};

export type Variables = {
  jobTrackerDb: JobTrackerDb;
  healthMonitorDb: HealthMonitorDb;
  authDb: AuthDb;
  identity: Identity;
  requestId: string;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

const app = new Hono<AppEnv>();

// Registration order: CORS (answers preflights before anything else runs)
// → logger → db-inject → identity resolution (V2) → routers. CORS uses
// hono/cors defaults — Access-Control-Allow-Origin: * (v1-plan Decision #8).
app.use('*', cors());
app.use('*', requestLogger);
app.use('*', dbClients);
app.use('*', resolveIdentity);

app.onError(handleError);
app.notFound(handleNotFound);

app.route('/auth', authRoutes);
app.route('/health', healthRoutes);
app.route('/', docsRoutes);
app.route('/jobs', jobsRoutes);
app.route('/glucose', glucoseRoutes);
app.route('/blood-pressure', bloodPressureRoutes);
app.route('/weight', weightRoutes);
app.route('/symptoms', symptomsRoutes);
app.route('/dashboard', dashboardRoutes);

export default app;
