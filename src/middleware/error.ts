import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { errorBody } from '../utils/responses';

// `app.onError` handler (Decision #34). Three tiers:
// - HTTPException: thrown by Hono itself (e.g. its json body parser throws a
//   400 "Malformed JSON in request body") — re-shaped into our envelope so
//   the client never sees Hono's plain-text default.
// - SyntaxError: a malformed JSON body surfacing directly from
//   `c.req.json()` → 400.
// - Anything else is a bug or infrastructure failure: logged with its route
//   context, mapped to a generic 500 that leaks no internals.
export function handleError(err: Error, c: Context): Response {
  if (err instanceof HTTPException) {
    return c.json(errorBody(err.message), err.status);
  }
  if (err instanceof SyntaxError) {
    return c.json(errorBody('Invalid JSON body'), 400);
  }
  console.error(`${c.req.method} ${c.req.path}`, err);
  return c.json(errorBody('Internal server error'), 500);
}

// `app.notFound` handler: unknown paths get the same envelope as unknown ids.
export function handleNotFound(c: Context): Response {
  return c.json(errorBody('Not found'), 404);
}
