import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { AppEnv } from '../app';
import { scopeIsDemo } from '../middleware/auth';
import { dateRangeQuerySchema, idParamSchema } from '../schemas/common.schema';
import { createSymptomSchema, updateSymptomSchema } from '../schemas/symptom.schema';
import {
  createSymptomEntry,
  listSymptomEntries,
  updateSymptomEntry,
} from '../services/symptom.service';
import { errorBody } from '../utils/responses';
import { validationHook } from '../utils/validation';

// One of four deliberately near-identical Health Monitor routers — see
// glucose.routes.ts for why there is no shared router factory.
export const symptomsRoutes = new Hono<AppEnv>();

symptomsRoutes.get('/', zValidator('query', dateRangeQuerySchema, validationHook), async (c) => {
  const rows = await listSymptomEntries(
    c.var.healthMonitorDb,
    c.req.valid('query'),
    scopeIsDemo(c.var.identity),
  );
  return c.json({ data: rows });
});

symptomsRoutes.post('/', zValidator('json', createSymptomSchema, validationHook), async (c) => {
  // The route owns ID generation (Decision #1).
  const id = crypto.randomUUID();
  const created = await createSymptomEntry(
    c.var.healthMonitorDb,
    id,
    c.req.valid('json'),
    scopeIsDemo(c.var.identity),
  );
  return c.json({ data: created }, 201);
});

symptomsRoutes.patch(
  '/:id',
  zValidator('param', idParamSchema, validationHook),
  zValidator('json', updateSymptomSchema, validationHook),
  async (c) => {
    const updated = await updateSymptomEntry(
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
