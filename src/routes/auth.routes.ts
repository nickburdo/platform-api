import { zValidator } from '@hono/zod-validator';
import type { Context } from 'hono';
import { Hono } from 'hono';
import type { AppEnv } from '../app';
import type { AuthDb } from '../db/auth/client';
import { requireUser } from '../middleware/auth';
import { requestLogContext } from '../middleware/logging';
import {
  googleCallbackQuerySchema,
  googleStartQuerySchema,
  loginSchema,
  registerSchema,
} from '../schemas/auth.schema';
import { deleteAccount, getMe, login, loginWithGoogle, register } from '../services/auth.service';
import {
  exchangeGoogleCode,
  type GoogleOAuthEnv,
} from '../services/google-oauth.service';
import { isAllowedRedirect, parseAllowedOrigins } from '../utils/frontend-origins';
import { issueOAuthState, verifyOAuthState } from '../utils/oauth-state';
import { errorBody } from '../utils/responses';
import { validationHook } from '../utils/validation';

export const authRoutes = new Hono<AppEnv>();

authRoutes.post('/register', zValidator('json', registerSchema, validationHook), async (c) => {
  const result = await register(c.var.authDb, c.req.valid('json'), c.env.JWT_SECRET);
  if (result === 'username_taken') {
    return c.json(errorBody('Username is already taken'), 409);
  }
  return c.json({ data: result }, 201);
});

authRoutes.post('/login', zValidator('json', loginSchema, validationHook), async (c) => {
  const result = await login(c.var.authDb, c.req.valid('json'), c.env.JWT_SECRET);
  if (!result) {
    return c.json(errorBody('Invalid credentials'), 401);
  }
  return c.json({ data: result });
});

authRoutes.get('/me', requireUser, async (c) => {
  const identity = c.var.identity;
  const user = identity.scope === 'user' ? await getMe(c.var.authDb, identity.userId) : undefined;
  if (!user) {
    return c.json(errorBody('Invalid or expired token'), 401);
  }
  return c.json({ data: user });
});

authRoutes.delete('/me', requireUser, async (c) => {
  const identity = c.var.identity;
  if (identity.scope !== 'user') {
    return c.json(errorBody('Authentication required'), 401);
  }
  await deleteAccount(
    {
      authDb: c.var.authDb,
      jobTrackerDb: c.var.jobTrackerDb,
      healthMonitorDb: c.var.healthMonitorDb,
    },
    identity.userId,
  );
  return c.body(null, 204);
});

// Derived from the incoming request rather than a configured base-URL env
// var — Decision #13 whitelists both the prod and local-dev host as
// redirect URIs on the same Google OAuth client, so whichever host actually
// received the request is the one Google must be told to come back to.
function googleCallbackUrl(c: Context<AppEnv>): string {
  return `${new URL(c.req.url).origin}/auth/google/callback`;
}

authRoutes.get('/google', zValidator('query', googleStartQuerySchema, validationHook), async (c) => {
  const { redirect } = c.req.valid('query');
  if (!isAllowedRedirect(redirect, parseAllowedOrigins(c.env.ALLOWED_FRONTEND_ORIGINS))) {
    return c.json(errorBody('redirect must be an allowed frontend URL'), 400);
  }
  const state = await issueOAuthState(c.env.JWT_SECRET, redirect);
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: googleCallbackUrl(c),
    response_type: 'code',
    scope: 'openid',
    state,
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, 302);
});

export type GoogleCallbackOutcome = { kind: 'invalid_state' } | { kind: 'redirect'; location: string };

interface GoogleCallbackDeps {
  authDb: AuthDb;
  env: GoogleOAuthEnv & { JWT_SECRET: string; ALLOWED_FRONTEND_ORIGINS: string };
  redirectUri: string;
  exchange: typeof exchangeGoogleCode;
  // Called with the cause of a swallowed failure (never the code or a token).
  logError?: (message: string, err: unknown) => void;
}

// A plain function, not a Hono handler — takes its dependencies explicitly
// (v3-plan.md Decision #11) so tests can substitute a fake `exchange` while
// exercising state verification, account creation, and JWT issuance for real
// against D1, with no Hono app or Context typing involved.
//
// Decision 14: an invalid state is the only case that cannot redirect (the
// target is unknown). Every other outcome is a redirect to the frontend
// carrying the result in the URL fragment, which is never sent to servers.
export async function resolveGoogleCallback(
  query: { state: string; code?: string; error?: string },
  deps: GoogleCallbackDeps,
): Promise<GoogleCallbackOutcome> {
  const state = await verifyOAuthState(query.state, deps.env.JWT_SECRET);
  // Defense in depth: the redirect was validated when the state was issued,
  // but it is re-checked against the current allow-list before use.
  if (
    !state ||
    !isAllowedRedirect(state.redirect, parseAllowedOrigins(deps.env.ALLOWED_FRONTEND_ORIGINS))
  ) {
    return { kind: 'invalid_state' };
  }
  const to = (fragment: string): GoogleCallbackOutcome => ({
    kind: 'redirect',
    location: `${state.redirect}#${fragment}`,
  });
  const logError = deps.logError ?? ((message, err) => console.error(message, err));

  if (query.error === 'access_denied') {
    return to('error=access_denied');
  }
  if (query.error || !query.code) {
    logError(`GET /auth/google/callback: Google returned error=${query.error ?? 'no code'}`, null);
    return to('error=google_failed');
  }

  try {
    const { sub } = await deps.exchange(query.code, deps.env, deps.redirectUri);
    const result = await loginWithGoogle(deps.authDb, sub, deps.env.JWT_SECRET);
    return to(`token=${encodeURIComponent(result.token)}`);
  } catch (err) {
    // Deliberately caught and mapped to a redirect instead of a 500 — without
    // this log, a misconfigured secret, a redirect_uri mismatch or a
    // Google-side outage would be invisible to the operator.
    logError('GET /auth/google/callback: Google sign-in failed', err);
    return to('error=google_failed');
  }
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
      logError: (message, err) =>
        console.error(message, { ...requestLogContext(c), error: err }),
    });
    if (outcome.kind === 'invalid_state') {
      return c.json(errorBody('Invalid or expired state'), 401);
    }
    return c.redirect(outcome.location, 302);
  },
);
