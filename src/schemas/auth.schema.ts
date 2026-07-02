import { z } from 'zod';

// The only auth input schema in V2 — registration is closed (v2-plan.md
// Decision #3), so there is no register schema. Strict per V1 Decision #32.
// Password is only checked for presence here: length policy applies at
// account creation (the bootstrap script), not at login.
export const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();
