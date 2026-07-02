import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { AppEnv } from '../app';
import { scopeIsDemo } from '../middleware/auth';
import { dateRangeQuerySchema } from '../schemas/common.schema';
import { getDashboardData } from '../services/dashboard.service';
import { validationHook } from '../utils/validation';

// GET /dashboard — aggregated Health Monitor data over an optional date range.
export const dashboardRoutes = new Hono<AppEnv>().get(
  '/',
  zValidator('query', dateRangeQuerySchema, validationHook),
  async (c) => {
    const data = await getDashboardData(c.var.healthMonitorDb, {
      ...c.req.valid('query'),
      isDemo: scopeIsDemo(c.var.identity),
    });
    return c.json({ data });
  },
);
