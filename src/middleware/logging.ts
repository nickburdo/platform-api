import { createMiddleware } from 'hono/factory';

// One line per request: method path status durationMs (Decision #35).
// Bodies and query values are never logged — nothing sensitive leaks.
export const requestLogger = createMiddleware(async (c, next) => {
  const start = Date.now();
  await next();
  console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${Date.now() - start}ms`);
});
