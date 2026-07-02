import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../app';
import { verifyToken } from '../utils/jwt';
import { errorBody } from '../utils/responses';

// Identity resolution (v2-plan.md Section 6, Decisions #1/#9/#10):
// - no Authorization header        → guest (demo scope), request proceeds
// - valid, unexpired admin token   → admin (real scope), request proceeds
// - header present but not a valid Bearer token → 401, never a silent
//   downgrade to guest (a stale admin token must not write demo data)
//
// There is no role check beyond this — "authenticated" and "is admin" are
// the same thing in the single-tenant model (ADR-012).
export type Identity = { scope: 'guest' } | { scope: 'admin'; userId: string };

export const resolveIdentity = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (header === undefined) {
    c.set('identity', { scope: 'guest' });
    await next();
    return;
  }

  const token = header.match(/^Bearer\s+(.+)$/i)?.[1];
  const payload = token === undefined ? null : await verifyToken(token, c.env.JWT_SECRET);
  if (payload === null) {
    return c.json(errorBody('Invalid or expired token'), 401);
  }

  c.set('identity', { scope: 'admin', userId: payload.sub });
  await next();
});

// The single place mapping identity → data scope (isDemo partition).
export function scopeIsDemo(identity: Identity): boolean {
  return identity.scope !== 'admin';
}
