import { Hono } from 'hono';
import type { AppEnv } from '../app';

// GET /health — liveness probe: no auth, no DB access, constant response.
export const healthRoutes = new Hono<AppEnv>().get('/', (c) =>
  c.json({ data: { status: 'ok' } }),
);
