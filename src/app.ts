import { Hono } from 'hono';

export type Bindings = {
  JOB_TRACKER_DB: D1Database;
  HEALTH_MONITOR_DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Routes and global middleware (error handling, logging, CORS) are added
// in later plan sections (see docs/plans/v1-plan.md, Sections 6 and 7).

export default app;
