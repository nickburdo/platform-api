import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { AppEnv } from '../app';
import { ownerIdOf, requireUser } from '../middleware/auth';
import { dateRangeQuerySchema, idParamSchema } from '../schemas/common.schema';
import { createWeightSchema, updateWeightSchema } from '../schemas/weight.schema';
import {
  createWeightMeasurement,
  listWeightMeasurements,
  updateWeightMeasurement,
} from '../services/weight.service';
import { errorBody } from '../utils/responses';
import { validationHook } from '../utils/validation';

// One of four deliberately near-identical Health Monitor routers — see
// glucose.routes.ts for why there is no shared router factory.
export const weightRoutes = new Hono<AppEnv>();

weightRoutes.get('/', zValidator('query', dateRangeQuerySchema, validationHook), async (c) => {
  const rows = await listWeightMeasurements(
    c.var.healthMonitorDb,
    c.req.valid('query'),
    ownerIdOf(c.var.identity),
  );
  return c.json({ data: rows });
});

weightRoutes.post(
  '/',
  requireUser,
  zValidator('json', createWeightSchema, validationHook),
  async (c) => {
    // The route owns ID generation (Decision #1).
    const id = crypto.randomUUID();
    const created = await createWeightMeasurement(
      c.var.healthMonitorDb,
      id,
      c.req.valid('json'),
      ownerIdOf(c.var.identity),
    );
    return c.json({ data: created }, 201);
  },
);

weightRoutes.patch(
  '/:id',
  requireUser,
  zValidator('param', idParamSchema, validationHook),
  zValidator('json', updateWeightSchema, validationHook),
  async (c) => {
    const updated = await updateWeightMeasurement(
      c.var.healthMonitorDb,
      c.req.valid('param').id,
      c.req.valid('json'),
      ownerIdOf(c.var.identity),
    );
    if (!updated) {
      return c.json(errorBody('Resource not found'), 404);
    }
    return c.json({ data: updated });
  },
);
