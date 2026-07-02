import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { AppEnv } from '../app';
import { idParamSchema } from '../schemas/common.schema';
import {
  createJobApplicationSchema,
  listJobApplicationsQuerySchema,
  updateJobApplicationSchema,
} from '../schemas/job-applications.schema';
import {
  createJobApplication,
  deleteJobApplication,
  findJobApplicationById,
  getJobApplicationsMeta,
  listJobApplications,
  updateJobApplication,
} from '../services/job-applications.service';
import { errorBody } from '../utils/responses';
import { validationHook } from '../utils/validation';

export const jobsRoutes = new Hono<AppEnv>();

// Registered before `/:id` so "meta" never matches as a job application id.
jobsRoutes.get('/meta', async (c) => {
  const meta = await getJobApplicationsMeta(c.var.jobTrackerDb);
  return c.json({ data: meta });
});

jobsRoutes.get(
  '/',
  zValidator('query', listJobApplicationsQuerySchema, validationHook),
  async (c) => {
    const { rows, meta } = await listJobApplications(c.var.jobTrackerDb, c.req.valid('query'));
    return c.json({ data: rows, meta });
  },
);

jobsRoutes.get('/:id', zValidator('param', idParamSchema, validationHook), async (c) => {
  const row = await findJobApplicationById(c.var.jobTrackerDb, c.req.valid('param').id);
  if (!row) {
    return c.json(errorBody('Resource not found'), 404);
  }
  return c.json({ data: row });
});

jobsRoutes.post('/', zValidator('json', createJobApplicationSchema, validationHook), async (c) => {
  // The route owns ID generation (Decision #1).
  const id = crypto.randomUUID();
  const created = await createJobApplication(c.var.jobTrackerDb, id, c.req.valid('json'));
  return c.json({ data: created }, 201);
});

jobsRoutes.patch(
  '/:id',
  zValidator('param', idParamSchema, validationHook),
  zValidator('json', updateJobApplicationSchema, validationHook),
  async (c) => {
    const updated = await updateJobApplication(
      c.var.jobTrackerDb,
      c.req.valid('param').id,
      c.req.valid('json'),
    );
    if (!updated) {
      return c.json(errorBody('Resource not found'), 404);
    }
    return c.json({ data: updated });
  },
);

jobsRoutes.delete('/:id', zValidator('param', idParamSchema, validationHook), async (c) => {
  const deleted = await deleteJobApplication(c.var.jobTrackerDb, c.req.valid('param').id);
  if (!deleted) {
    return c.json(errorBody('Resource not found'), 404);
  }
  return c.json({ data: { success: true } });
});
