import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../app';
import { findUserById } from '../db/auth/users.repository';
import { verifyToken } from '../utils/jwt';
import type { OwnerId } from '../utils/owner';
import { errorBody } from '../utils/responses';

// Identity resolution (spec §7.1):
// - no Authorization header            → guest (demo scope), request proceeds
// - valid token and the user exists    → user (own data), request proceeds
// - header present but not a valid Bearer token, or the user no longer
//   exists → 401 'Invalid or expired token', never a silent downgrade to
//   guest (a stale token must not show demo data as if nothing happened)
export type Identity = { scope: 'guest' } | { scope: 'user'; userId: string };

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

  // Decision 4: a validly signed token of a deleted account is rejected.
  const user = await findUserById(c.var.authDb, payload.sub);
  if (!user) {
    return c.json(errorBody('Invalid or expired token'), 401);
  }

  c.set('identity', { scope: 'user', userId: user.id });
  await next();
});

// Guard for user-only routes; mounted before any validator so a guest gets
// 401 rather than 400 for an invalid body (Decision 3).
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (c.var.identity.scope !== 'user') {
    return c.json(errorBody('Authentication required'), 401);
  }
  await next();
});

// null = demo scope.
export function ownerIdOf(identity: Identity): OwnerId {
  return identity.scope === 'user' ? identity.userId : null;
}
