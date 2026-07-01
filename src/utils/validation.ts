import type { ZodError } from 'zod';

export interface ErrorResponseBody {
  error: {
    message: string;
    details: Record<string, unknown>;
  };
}

// Maps a Zod validation failure to the documented 400 error shape
// (api.md: { error: { message, details } }), per v1-plan.md Decision #7 —
// `details` mirrors Zod's flattened field-error map.
export function zodErrorToResponse(error: ZodError): ErrorResponseBody {
  return {
    error: {
      message: 'Validation error',
      details: error.flatten().fieldErrors,
    },
  };
}
