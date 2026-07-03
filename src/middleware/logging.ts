import { createMiddleware } from 'hono/factory';

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
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Date.now() - start,
    })
  );
});
