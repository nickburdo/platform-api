import { zValidator } from '@hono/zod-validator';
import type { Context } from 'hono';
import { Hono } from 'hono';
import type { AppEnv } from '../app';
import type { AuthDb } from '../db/auth/client';
import { googleCallbackQuerySchema, loginSchema } from '../schemas/auth.schema';
import { getMe, login, loginWithGoogle, type LoginResult } from '../services/auth.service';
import {
  exchangeGoogleCode,
  type GoogleOAuthEnv,
} from '../services/google-oauth.service';
import { issueOAuthState, verifyOAuthState } from '../utils/oauth-state';
import { errorBody } from '../utils/responses';
import { validationHook } from '../utils/validation';

// POST /auth/register is deliberately absent (v2-plan.md Decision #3):
// registration is closed, so the path falls through to the global 404.
export const authRoutes = new Hono<AppEnv>();

authRoutes.post('/login', zValidator('json', loginSchema, validationHook), async (c) => {
  const result = await login(c.var.authDb, c.req.valid('json'), c.env.JWT_SECRET);
  if (!result) {
    return c.json(errorBody('Invalid credentials'), 401);
  }
  return c.json({ data: result });
});

authRoutes.get('/me', async (c) => {
  const identity = c.var.identity;
  if (identity.scope !== 'admin') {
    return c.json(errorBody('Unauthorized'), 401);
  }
  const user = await getMe(c.var.authDb, identity.userId);
  if (!user) {
    // The token is valid but its user row is gone (e.g. auth-db was reset).
    return c.json(errorBody('Unauthorized'), 401);
  }
  return c.json({ data: user });
});

// Derived from the incoming request rather than a configured base-URL env
// var — Decision #13 whitelists both the prod and local-dev host as
// redirect URIs on the same Google OAuth client, so whichever host actually
// received the request is the one Google must be told to come back to.
function googleCallbackUrl(c: Context<AppEnv>): string {
  return `${new URL(c.req.url).origin}/auth/google/callback`;
}

authRoutes.get('/google', async (c) => {
  const state = await issueOAuthState(c.env.JWT_SECRET);
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: googleCallbackUrl(c),
    response_type: 'code',
    scope: 'openid email',
    state,
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, 302);
});

export type GoogleCallbackOutcome =
  | { ok: true; result: LoginResult }
  | { ok: false; reason: 'invalid_state' | 'invalid_credentials' };

interface GoogleCallbackDeps {
  authDb: AuthDb;
  env: GoogleOAuthEnv & { JWT_SECRET: string };
  redirectUri: string;
  exchange: typeof exchangeGoogleCode;
}

// A plain function, not a Hono handler — takes its dependencies explicitly
// (v3-plan.md Decision #11) so tests can substitute a fake `exchange` while
// exercising state verification, email lookup, and JWT issuance for real
// against D1, with no Hono app or Context typing involved.
export async function resolveGoogleCallback(
  params: { code: string; state: string },
  deps: GoogleCallbackDeps,
): Promise<GoogleCallbackOutcome> {
  if (!(await verifyOAuthState(params.state, deps.env.JWT_SECRET))) {
    return { ok: false, reason: 'invalid_state' };
  }

  let email: string;
  try {
    ({ email } = await deps.exchange(params.code, deps.env, deps.redirectUri));
  } catch (err) {
    // Logged here (rather than left to bubble to the global handleError)
    // because it's deliberately caught and mapped to a generic 401 instead
    // of a 500 — without this, a misconfigured secret, a redirect_uri
    // mismatch, or a Google-side outage would be silently indistinguishable
    // from a user just picking the wrong Google account.
    console.error('GET /auth/google/callback: exchangeGoogleCode failed', err);
    return { ok: false, reason: 'invalid_credentials' };
  }

  const result = await loginWithGoogle(deps.authDb, email, deps.env.JWT_SECRET);
  if (!result) {
    return { ok: false, reason: 'invalid_credentials' };
  }
  return { ok: true, result };
}

authRoutes.get(
  '/google/callback',
  zValidator('query', googleCallbackQuerySchema, validationHook),
  async (c) => {
    const outcome = await resolveGoogleCallback(c.req.valid('query'), {
      authDb: c.var.authDb,
      env: c.env,
      redirectUri: googleCallbackUrl(c),
      exchange: exchangeGoogleCode,
    });
    if (!outcome.ok) {
      const message =
        outcome.reason === 'invalid_state' ? 'Invalid or expired state' : 'Invalid credentials';
      return c.json(errorBody(message), 401);
    }
    return c.json({ data: outcome.result });
  },
);
