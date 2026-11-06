import { z } from 'zod';

// Username: ASCII letters, digits, underscore, hyphen; 3-32 chars. Uniqueness
// is case-insensitive and enforced by the DB (v4-plan.md Decision 5).
const USERNAME_MESSAGE = 'username must be 3-32 characters: letters, digits, "_" or "-"';

export const registerSchema = z
  .object({
    username: z
      .string('username is required')
      .min(3, USERNAME_MESSAGE)
      .max(32, USERNAME_MESSAGE)
      .regex(/^[A-Za-z0-9_-]+$/, USERNAME_MESSAGE),
    password: z
      .string('password is required')
      .min(8, 'password must be at least 8 characters')
      .max(128, 'password must be at most 128 characters'),
  })
  .strict();

// No format rule on login: a malformed username simply fails to match and
// yields the uniform 401. Strict per V1 Decision #32.
export const loginSchema = z
  .object({
    username: z.string('username is required').min(1, 'username is required'),
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
