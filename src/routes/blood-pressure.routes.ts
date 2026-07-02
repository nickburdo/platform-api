import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { AppEnv } from '../app';
import {
  createBloodPressureSchema,
  updateBloodPressureSchema,
} from '../schemas/blood-pressure.schema';
import { dateRangeQuerySchema, idParamSchema } from '../schemas/common.schema';
import {
  createBloodPressureMeasurement,
  listBloodPressureMeasurements,
  updateBloodPressureMeasurement,
} from '../services/blood-pressure.service';
import { errorBody } from '../utils/responses';
import { validationHook } from '../utils/validation';

// One of four deliberately near-identical Health Monitor routers — see
// glucose.routes.ts for why there is no shared router factory.
export const bloodPressureRoutes = new Hono<AppEnv>();

bloodPressureRoutes.get(
  '/',
  zValidator('query', dateRangeQuerySchema, validationHook),
  async (c) => {
    const rows = await listBloodPressureMeasurements(c.var.healthMonitorDb, c.req.valid('query'));
    return c.json({ data: rows });
  },
);

bloodPressureRoutes.post(
  '/',
  zValidator('json', createBloodPressureSchema, validationHook),
  async (c) => {
    // The route owns ID generation (Decision #1).
    const id = crypto.randomUUID();
    const created = await createBloodPressureMeasurement(
      c.var.healthMonitorDb,
      id,
      c.req.valid('json'),
    );
    return c.json({ data: created }, 201);
  },
);

bloodPressureRoutes.patch(
  '/:id',
  zValidator('param', idParamSchema, validationHook),
  zValidator('json', updateBloodPressureSchema, validationHook),
  async (c) => {
    const updated = await updateBloodPressureMeasurement(
      c.var.healthMonitorDb,
      c.req.valid('param').id,
      c.req.valid('json'),
    );
    if (!updated) {
      return c.json(errorBody('Resource not found'), 404);
    }
    return c.json({ data: updated });
  },
);
