import type { Context } from 'hono';
import { z } from 'zod';
import type { $ZodError } from 'zod/v4/core';

export interface ErrorResponseBody {
  error: {
    message: string;
    details: Record<string, unknown>;
  };
}

// Maps a Zod validation failure to the documented 400 error shape
// (api.md: { error: { message, details } }), per v1-plan.md Decision #7 —
// `details` mirrors Zod's flattened field-error map. Root-level issues
// (unrecognized keys from `.strict()`, object-wide refines like the empty
// PATCH rule) have no field to attach to; they land under `_errors`, the
// same root key Zod itself uses in its tree format.
// Takes the core `$ZodError` (what @hono/zod-validator's hook receives in
// Zod 4 — it has no `.flatten()` method), flattened via the top-level
// `z.flattenError()`. The classic `ZodError` from `safeParse` extends it.
export function zodErrorToResponse(error: $ZodError): ErrorResponseBody {
  const { fieldErrors, formErrors } = z.flattenError(
    error as $ZodError<Record<string, unknown>>,
  );
  return {
    error: {
      message: 'Validation error',
      details: formErrors.length > 0 ? { ...fieldErrors, _errors: formErrors } : fieldErrors,
    },
  };
}

// Shared @hono/zod-validator hook (Decision #31): every failed validation —
// body, query, or path param — returns the documented 400 shape above
// instead of zValidator's default response.
export function validationHook(
  result: { success: boolean; error?: $ZodError },
  c: Context,
): Response | undefined {
  if (!result.success && result.error) {
    return c.json(zodErrorToResponse(result.error), 400);
  }
  return undefined;
}
