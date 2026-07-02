// Builds the documented error envelope (api.md: { error: { message, details } }).
// `details` is only present when there is something structured to report —
// validation errors attach the Zod field-error map (see validation.ts);
// 404/500 bodies carry just the message.
export interface ErrorBody {
  error: {
    message: string;
    details?: Record<string, unknown>;
  };
}

export function errorBody(message: string, details?: Record<string, unknown>): ErrorBody {
  return { error: details === undefined ? { message } : { message, details } };
}
