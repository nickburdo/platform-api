import { z } from 'zod';

// The only auth input schema in V2 — registration is closed (v2-plan.md
// Decision #3), so there is no register schema. Strict per V1 Decision #32.
// Password is only checked for presence here: length policy applies at
// account creation (the bootstrap script), not at login.
export const loginSchema = z
  .object({
    email: z.string('email is required').email(),
    password: z.string('password is required').min(1, 'password is required'),
  })
  .strict();

// GET /auth/google/callback's query params, forwarded by Google. Not
// `.strict()` — Google may append extra params (e.g. `scope`, `authuser`)
// we don't care about, and unknown query params are ignored project-wide
// (api.md), unlike unknown body keys.
export const googleCallbackQuerySchema = z.object({
  code: z.string('code is required').min(1, 'code is required'),
  state: z.string('state is required').min(1, 'state is required'),
});
