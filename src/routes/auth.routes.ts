import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { AppEnv } from '../app';
import { loginSchema } from '../schemas/auth.schema';
import { getMe, login } from '../services/auth.service';
import { errorBody } from '../utils/responses';
import { validationHook } from '../utils/validation';

// POST /auth/register is deliberately absent (v2-plan.md Decision #3):
// registration is closed, so the path falls through to the global 404.
export const authRoutes = new Hono<AppEnv>();

authRoutes.post('/login', zValidator('json', loginSchema, validationHook), async (c) => {
  const result = await login(c.var.authDb, c.req.valid('json'), c.env.JWT_SECRET);
  if (!result) {
    return c.json(errorBody('Invalid credentials'), 401);
  }
  return c.json({ data: result });
});

authRoutes.get('/me', async (c) => {
  const identity = c.var.identity;
  if (identity.scope !== 'admin') {
    return c.json(errorBody('Unauthorized'), 401);
  }
  const user = await getMe(c.var.authDb, identity.userId);
  if (!user) {
    // The token is valid but its user row is gone (e.g. auth-db was reset).
    return c.json(errorBody('Unauthorized'), 401);
  }
  return c.json({ data: user });
});
