import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';

// Shared correlation fields for every structured log line (Decision #12).
// `requestId` falls back to 'unknown' rather than being silently dropped by
// JSON.stringify — this only fires if a handler runs before requestLogger
// (currently impossible; cors() is the only earlier middleware and never
// throws), or a test invokes handleError outside the normal middleware chain.
export function requestLogContext(c: Context) {
  return {
    requestId: c.get('requestId') ?? 'unknown',
    method: c.req.method,
    path: c.req.path,
  };
}

// One structured line per request: method, path, status, duration, request ID
// (Decision #35, extended by V3 Decision #12). Bodies and query values are
// never logged — nothing sensitive leaks.
export const requestLogger = createMiddleware(async (c, next) => {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-Id', requestId);
  await next();
  console.log(
    JSON.stringify({
      ...requestLogContext(c),
      status: c.res.status,
      durationMs: Date.now() - start,
    })
  );
});
