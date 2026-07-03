import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { users } from '../db/auth/schema';
import { freshAuthDb } from '../db/auth/test-helpers';
import { issueOAuthState } from '../utils/oauth-state';
import { resolveGoogleCallback } from './auth.routes';
import { bearer, request, requestJson, seedAdminAndGetToken } from './test-helpers';

interface DataEnvelope {
  data: Record<string, unknown>;
}

interface ErrorEnvelope {
  error: { message: string; details?: Record<string, unknown> };
}

beforeEach(async () => {
  await freshAuthDb();
});

describe('POST /auth/register', () => {
  it('is not implemented — falls through to the global 404 (Decision #3)', async () => {
    const res = await requestJson('POST', '/auth/register', {
      email: 'new@example.com',
      password: 'whatever12345',
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /auth/login', () => {
  it('issues a token and the public user on correct credentials', async () => {
    const { email, password } = await seedAdminAndGetToken();
    const res = await requestJson('POST', '/auth/login', { email, password });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as DataEnvelope;
    expect(typeof data.token).toBe('string');
    const user = data.user as Record<string, unknown>;
    expect(user.email).toBe(email);
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('returns a generic 401 for a wrong password (no user enumeration)', async () => {
    const { email } = await seedAdminAndGetToken();
    const res = await requestJson('POST', '/auth/login', { email, password: 'wrong' });
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.message).toBe('Invalid credentials');
  });

  it('returns the same generic 401 for an unknown email', async () => {
    const res = await requestJson('POST', '/auth/login', {
      email: 'nobody@example.com',
      password: 'whatever12345',
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.message).toBe('Invalid credentials');
  });

  it('rejects a malformed body with 400', async () => {
    const res = await requestJson('POST', '/auth/login', { email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('rejects unknown keys such as a client-supplied role (strict)', async () => {
    const { email, password } = await seedAdminAndGetToken();
    const res = await requestJson('POST', '/auth/login', { email, password, role: 'ADMIN' });
    expect(res.status).toBe(400);
  });
});

describe('GET /auth/me', () => {
  it('returns the current user for a valid admin token', async () => {
    const { token, email } = await seedAdminAndGetToken();
    const res = await request('/auth/me', { headers: bearer(token) });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as DataEnvelope;
    expect(data.email).toBe(email);
    expect(data).not.toHaveProperty('passwordHash');
  });

  it('returns 401 without a token (guest)', async () => {
    const res = await request('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed/invalid token', async () => {
    const res = await request('/auth/me', { headers: bearer('not-a-jwt') });
    expect(res.status).toBe(401);
  });
});

describe('GET /auth/google', () => {
  it('redirects to the Google consent screen with the required params', async () => {
    const res = await request('/auth/google', { redirect: 'manual' });
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('Location')!);
    expect(`${location.origin}${location.pathname}`).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(location.searchParams.get('client_id')).toBe(env.GOOGLE_CLIENT_ID);
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('scope')).toBe('openid email');
    expect(location.searchParams.get('redirect_uri')).toMatch(/\/auth\/google\/callback$/);
    expect(location.searchParams.get('state')).toBeTruthy();
  });
});

describe('GET /auth/google/callback', () => {
  it('rejects a missing code/state with 400', async () => {
    const res = await request('/auth/google/callback');
    expect(res.status).toBe(400);
  });

  it('rejects an invalid state with 401, before ever reaching Google', async () => {
    const res = await request('/auth/google/callback?code=irrelevant&state=garbage');
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.message).toBe('Invalid or expired state');
  });

  it('rejects an expired/wrong-purpose state with 401', async () => {
    // A real access token (wrong `purpose`) is a structurally valid JWT
    // signed with the same secret — must still be rejected as state.
    const { token } = await seedAdminAndGetToken();
    const res = await request(`/auth/google/callback?code=irrelevant&state=${token}`);
    expect(res.status).toBe(401);
  });
});

describe('resolveGoogleCallback', () => {
  const REDIRECT_URI = 'https://example.com/auth/google/callback';
  const oauthEnv = {
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    JWT_SECRET: env.JWT_SECRET,
  };

  it('never calls exchange when the state is invalid', async () => {
    const db = await freshAuthDb();
    const exchange = vi.fn();
    const outcome = await resolveGoogleCallback(
      { code: 'irrelevant', state: 'garbage' },
      { authDb: db, env: oauthEnv, redirectUri: REDIRECT_URI, exchange },
    );
    expect(outcome).toEqual({ ok: false, reason: 'invalid_state' });
    expect(exchange).not.toHaveBeenCalled();
  });

  it('issues a token when the exchanged email matches the admin', async () => {
    const db = await freshAuthDb();
    const { email } = await seedAdminAndGetToken();
    const state = await issueOAuthState(env.JWT_SECRET);
    const exchange = vi.fn().mockResolvedValue({ email });

    const outcome = await resolveGoogleCallback(
      { code: 'auth-code', state },
      { authDb: db, env: oauthEnv, redirectUri: REDIRECT_URI, exchange },
    );

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.user.email).toBe(email);
      expect(outcome.result.user).not.toHaveProperty('passwordHash');
    }
    expect(exchange).toHaveBeenCalledWith('auth-code', oauthEnv, REDIRECT_URI);
  });

  it('matches the admin email case-insensitively', async () => {
    const db = await freshAuthDb();
    await seedAdminAndGetToken({ email: 'admin@example.com' });
    const state = await issueOAuthState(env.JWT_SECRET);
    const exchange = vi.fn().mockResolvedValue({ email: 'Admin@Example.com' });

    const outcome = await resolveGoogleCallback(
      { code: 'auth-code', state },
      { authDb: db, env: oauthEnv, redirectUri: REDIRECT_URI, exchange },
    );
    expect(outcome.ok).toBe(true);
  });

  it('rejects with no user created when the exchanged email has no matching admin', async () => {
    const db = await freshAuthDb();
    await seedAdminAndGetToken();
    const state = await issueOAuthState(env.JWT_SECRET);
    const exchange = vi.fn().mockResolvedValue({ email: 'nobody@example.com' });

    const outcome = await resolveGoogleCallback(
      { code: 'auth-code', state },
      { authDb: db, env: oauthEnv, redirectUri: REDIRECT_URI, exchange },
    );
    expect(outcome).toEqual({ ok: false, reason: 'invalid_credentials' });
    const rows = await db.select().from(users);
    expect(rows).toHaveLength(1);
  });

  it('rejects when exchange itself fails (bad/expired code)', async () => {
    const db = await freshAuthDb();
    const state = await issueOAuthState(env.JWT_SECRET);
    const exchange = vi.fn().mockRejectedValue(new Error('Google token exchange failed: 400'));

    const outcome = await resolveGoogleCallback(
      { code: 'bad-code', state },
      { authDb: db, env: oauthEnv, redirectUri: REDIRECT_URI, exchange },
    );
    expect(outcome).toEqual({ ok: false, reason: 'invalid_credentials' });
  });
});
