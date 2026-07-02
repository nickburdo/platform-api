import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { AppEnv } from '../app';
import { dateRangeQuerySchema, idParamSchema } from '../schemas/common.schema';
import { createGlucoseSchema, updateGlucoseSchema } from '../schemas/glucose.schema';
import { scopeIsDemo } from '../middleware/auth';
import {
  createGlucoseMeasurement,
  listGlucoseMeasurements,
  updateGlucoseMeasurement,
} from '../services/glucose.service';
import { errorBody } from '../utils/responses';
import { validationHook } from '../utils/validation';

// One of four deliberately near-identical Health Monitor routers — kept as
// explicit copies rather than a generic router factory (see v1-plan.md
// Section 7.3 and the Decision #28 precedent).
export const glucoseRoutes = new Hono<AppEnv>();

glucoseRoutes.get('/', zValidator('query', dateRangeQuerySchema, validationHook), async (c) => {
  const rows = await listGlucoseMeasurements(
    c.var.healthMonitorDb,
    c.req.valid('query'),
    scopeIsDemo(c.var.identity),
  );
  return c.json({ data: rows });
});

glucoseRoutes.post('/', zValidator('json', createGlucoseSchema, validationHook), async (c) => {
  // The route owns ID generation (Decision #1).
  const id = crypto.randomUUID();
  const created = await createGlucoseMeasurement(
    c.var.healthMonitorDb,
    id,
    c.req.valid('json'),
    scopeIsDemo(c.var.identity),
  );
  return c.json({ data: created }, 201);
});

glucoseRoutes.patch(
  '/:id',
  zValidator('param', idParamSchema, validationHook),
  zValidator('json', updateGlucoseSchema, validationHook),
  async (c) => {
    const updated = await updateGlucoseMeasurement(
      c.var.healthMonitorDb,
      c.req.valid('param').id,
      c.req.valid('json'),
      scopeIsDemo(c.var.identity),
    );
    if (!updated) {
      return c.json(errorBody('Resource not found'), 404);
    }
    return c.json({ data: updated });
  },
);
