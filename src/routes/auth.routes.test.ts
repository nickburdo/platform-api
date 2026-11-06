import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthDb } from '../db/auth/client';
import { findUserById } from '../db/auth/users.repository';
import { createHealthMonitorDb } from '../db/health-monitor/client';
import {
  createGlucoseMeasurement,
  listGlucoseMeasurements,
} from '../db/health-monitor/glucose.repository';
import {
  bloodPressureMeasurements,
  glucoseMeasurements,
  symptomEntries,
  weightMeasurements,
} from '../db/health-monitor/schema';
import { createSymptomEntry, listSymptomEntries } from '../db/health-monitor/symptoms.repository';
import { freshHealthMonitorDb } from '../db/health-monitor/test-helpers';
import { createJobTrackerDb } from '../db/job-tracker/client';
import {
  createJobApplication,
  listJobApplications,
} from '../db/job-tracker/job-applications.repository';
import { freshJobTrackerDb } from '../db/job-tracker/test-helpers';
import { users } from '../db/auth/schema';
import { freshAuthDb } from '../db/auth/test-helpers';
import { toPublicUser } from '../services/auth.service';
import { issueToken, verifyToken } from '../utils/jwt';
import { issueOAuthState, verifyOAuthState } from '../utils/oauth-state';
import { resolveGoogleCallback } from './auth.routes';
import { bearer, request, requestJson, seedUserAndGetToken } from './test-helpers';

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
  it('creates the account: 201 with a token and the public user only', async () => {
    const res = await requestJson('POST', '/auth/register', {
      username: 'Nick',
      password: 'password1',
    });
    expect(res.status).toBe(201);
    const { data } = (await res.json()) as DataEnvelope;
    expect(typeof data.token).toBe('string');
    const user = data.user as Record<string, unknown>;
    expect(user).toMatchObject({ username: 'Nick', hasPassword: true });
    expect(typeof user.id).toBe('string');
    expect(typeof user.createdAt).toBe('string');
    expect(typeof user.updatedAt).toBe('string');
    for (const key of ['passwordHash', 'googleSub', 'email', 'role']) {
      expect(user).not.toHaveProperty(key);
    }
  });

  it('the issued token works on GET /auth/me', async () => {
    const res = await requestJson('POST', '/auth/register', {
      username: 'Nick',
      password: 'password1',
    });
    const { data } = (await res.json()) as DataEnvelope;
    const me = await request('/auth/me', { headers: bearer(data.token as string) });
    expect(me.status).toBe(200);
  });

  it('rejects a username differing only in case with 409', async () => {
    await requestJson('POST', '/auth/register', { username: 'Nick', password: 'password1' });
    const res = await requestJson('POST', '/auth/register', {
      username: 'nick',
      password: 'password2',
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.message).toBe('Username is already taken');
  });

  it('rejects an invalid username or short password with 400', async () => {
    expect(
      (await requestJson('POST', '/auth/register', { username: 'ab', password: 'password1' }))
        .status,
    ).toBe(400);
    expect(
      (await requestJson('POST', '/auth/register', { username: 'nick', password: '1234567' }))
        .status,
    ).toBe(400);
  });

  it('rejects unknown keys such as a client-supplied role (strict)', async () => {
    const res = await requestJson('POST', '/auth/register', {
      username: 'nick',
      password: 'password1',
      role: 'ADMIN',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  it('issues a token and the public user on correct credentials', async () => {
    const { username, password } = await seedUserAndGetToken();
    const res = await requestJson('POST', '/auth/login', { username, password });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as DataEnvelope;
    expect(typeof data.token).toBe('string');
    const user = data.user as Record<string, unknown>;
    expect(user.username).toBe(username);
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('matches the username case-insensitively (Nick registered, NICK logs in)', async () => {
    await requestJson('POST', '/auth/register', { username: 'Nick', password: 'password1' });
    const res = await requestJson('POST', '/auth/login', {
      username: 'NICK',
      password: 'password1',
    });
    expect(res.status).toBe(200);
  });

  it('returns a generic 401 for a wrong password (no user enumeration)', async () => {
    const { username } = await seedUserAndGetToken();
    const res = await requestJson('POST', '/auth/login', { username, password: 'wrong' });
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.message).toBe('Invalid credentials');
  });

  it('returns the same generic 401 for an unknown username', async () => {
    const res = await requestJson('POST', '/auth/login', {
      username: 'nobody',
      password: 'whatever12345',
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.message).toBe('Invalid credentials');
  });

  it('returns the same generic 401 for a malformed username', async () => {
    const res = await requestJson('POST', '/auth/login', {
      username: 'not a valid name!',
      password: 'whatever12345',
    });
    expect(res.status).toBe(401);
  });

  it('returns the same generic 401 for a Google-only account (no password)', async () => {
    const now = new Date().toISOString();
    await (await freshAuthDb()).insert(users).values({
      id: 'google-1',
      username: 'googler',
      passwordHash: null,
      googleSub: 'sub-1',
      createdAt: now,
      updatedAt: now,
    });
    const res = await requestJson('POST', '/auth/login', {
      username: 'googler',
      password: 'whatever12345',
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.message).toBe('Invalid credentials');
  });

  it('rejects a malformed body with 400', async () => {
    const res = await requestJson('POST', '/auth/login', { username: 'nick' });
    expect(res.status).toBe(400);
  });

  it('rejects unknown keys such as a client-supplied role (strict)', async () => {
    const { username, password } = await seedUserAndGetToken();
    const res = await requestJson('POST', '/auth/login', { username, password, role: 'ADMIN' });
    expect(res.status).toBe(400);
  });
});

describe('GET /auth/me', () => {
  it('returns the current user for a valid token', async () => {
    const { token, username } = await seedUserAndGetToken();
    const res = await request('/auth/me', { headers: bearer(token) });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as DataEnvelope;
    expect(data.username).toBe(username);
    expect(data.hasPassword).toBe(true);
    expect(data).not.toHaveProperty('passwordHash');
  });

  it('returns 401 Authentication required without a token (guest)', async () => {
    const res = await request('/auth/me');
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.message).toBe('Authentication required');
  });

  it('returns 401 for a malformed/invalid token', async () => {
    const res = await request('/auth/me', { headers: bearer('not-a-jwt') });
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.message).toBe('Invalid or expired token');
  });
});

describe('identity resolution', () => {
  it('rejects a validly signed token of a user that does not exist with 401', async () => {
    const token = await issueToken(crypto.randomUUID(), env.JWT_SECRET);
    const res = await request('/jobs', { headers: bearer(token) });
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.message).toBe('Invalid or expired token');
  });
});

const FRONTEND = 'https://job-tracker-new.pages.dev/auth/callback';

describe('GET /auth/google', () => {
  it('redirects to the Google consent screen with scope=openid and a state', async () => {
    const res = await request(`/auth/google?redirect=${encodeURIComponent(FRONTEND)}`, {
      redirect: 'manual',
    });
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('Location')!);
    expect(location.host).toBe('accounts.google.com');
    expect(`${location.origin}${location.pathname}`).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(location.searchParams.get('client_id')).toBe(env.GOOGLE_CLIENT_ID);
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('scope')).toBe('openid');
    expect(location.searchParams.get('redirect_uri')).toMatch(/\/auth\/google\/callback$/);
    const state = location.searchParams.get('state')!;
    expect(await verifyOAuthState(state, env.JWT_SECRET)).toEqual({ redirect: FRONTEND });
  });

  it.each(['/auth/google', '/auth/google?redirect='])(
    'rejects a missing or empty redirect (%s) with the documented 400 message',
    async (path) => {
      const res = await request(path, { redirect: 'manual' });
      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorEnvelope;
      expect(body.error.message).toBe('redirect must be an allowed frontend URL');
    },
  );

  it.each([
    'https://job-tracker-new.pages.dev.evil.com/x',
    'https://evil.com/?r=https://job-tracker-new.pages.dev',
    '//evil.com',
    'javascript:alert(1)',
    'http://job-tracker-new.pages.dev/x',
    'https://job-tracker-new.pages.dev/x#frag',
    'https://job-tracker-new.pages.dev/x\n',
    ' https://job-tracker-new.pages.dev/x',
  ])('rejects the look-alike redirect %s with 400 and no redirect', async (redirect) => {
    const res = await request(`/auth/google?redirect=${encodeURIComponent(redirect)}`, {
      redirect: 'manual',
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('Location')).toBeNull();
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.message).toBe('redirect must be an allowed frontend URL');
  });
});

describe('GET /auth/google/callback', () => {
  it.each(['/auth/google/callback?code=irrelevant', '/auth/google/callback?code=x&state='])(
    'rejects a missing or empty state (%s) with 401 Invalid or expired state',
    async (path) => {
      const res = await request(path, { redirect: 'manual' });
      expect(res.status).toBe(401);
      const body = (await res.json()) as ErrorEnvelope;
      expect(body.error.message).toBe('Invalid or expired state');
    },
  );

  it('rejects a tampered state with 401 JSON, before ever reaching Google', async () => {
    const res = await request('/auth/google/callback?code=irrelevant&state=garbage', {
      redirect: 'manual',
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error.message).toBe('Invalid or expired state');
  });

  it('rejects a wrong-purpose state (a real access token) with 401', async () => {
    const { token } = await seedUserAndGetToken();
    const res = await request(`/auth/google/callback?code=irrelevant&state=${token}`, {
      redirect: 'manual',
    });
    expect(res.status).toBe(401);
  });

  it('redirects to the frontend with #error=access_denied when the user cancels', async () => {
    const state = await issueOAuthState(env.JWT_SECRET, FRONTEND);
    const res = await request(`/auth/google/callback?error=access_denied&state=${state}`, {
      redirect: 'manual',
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(`${FRONTEND}#error=access_denied`);
  });
});

describe('resolveGoogleCallback', () => {
  const REDIRECT_URI = 'https://example.com/auth/google/callback';
  const oauthEnv = {
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    JWT_SECRET: env.JWT_SECRET,
    ALLOWED_FRONTEND_ORIGINS: env.ALLOWED_FRONTEND_ORIGINS,
  };
  const logError = vi.fn();

  beforeEach(() => {
    logError.mockClear();
  });

  it('never calls exchange when the state is invalid', async () => {
    const db = await freshAuthDb();
    const exchange = vi.fn();
    const outcome = await resolveGoogleCallback(
      { code: 'irrelevant', state: 'garbage' },
      { authDb: db, env: oauthEnv, redirectUri: REDIRECT_URI, exchange, logError },
    );
    expect(outcome).toEqual({ kind: 'invalid_state' });
    expect(exchange).not.toHaveBeenCalled();
  });

  it('rejects a validly signed state whose redirect is not allowed (defense in depth)', async () => {
    const db = await freshAuthDb();
    const exchange = vi.fn();
    const state = await issueOAuthState(env.JWT_SECRET, 'https://evil.com/cb');
    const outcome = await resolveGoogleCallback(
      { code: 'c', state },
      { authDb: db, env: oauthEnv, redirectUri: REDIRECT_URI, exchange, logError },
    );
    expect(outcome).toEqual({ kind: 'invalid_state' });
    expect(exchange).not.toHaveBeenCalled();
  });

  it('creates a Google-only account and redirects with a verifiable token fragment', async () => {
    const db = await freshAuthDb();
    const state = await issueOAuthState(env.JWT_SECRET, FRONTEND);
    const exchange = vi.fn().mockResolvedValue({ sub: 'sub-123' });

    const outcome = await resolveGoogleCallback(
      { code: 'auth-code', state },
      { authDb: db, env: oauthEnv, redirectUri: REDIRECT_URI, exchange, logError },
    );

    expect(exchange).toHaveBeenCalledWith('auth-code', oauthEnv, REDIRECT_URI);
    expect(outcome.kind).toBe('redirect');
    if (outcome.kind !== 'redirect') {
      return;
    }
    const [base, fragment] = outcome.location.split('#');
    expect(base).toBe(FRONTEND);
    const token = new URLSearchParams(fragment).get('token')!;
    const payload = await verifyToken(token, env.JWT_SECRET);
    const user = await findUserById(db, payload!.sub);
    expect(user?.googleSub).toBe('sub-123');
    expect(user?.passwordHash).toBeNull();
    expect(toPublicUser(user!).hasPassword).toBe(false);
  });

  it('redirects with #error=google_failed when exchange throws, logging the cause', async () => {
    const db = await freshAuthDb();
    const state = await issueOAuthState(env.JWT_SECRET, FRONTEND);
    const exchange = vi.fn().mockRejectedValue(new Error('Google token exchange failed: 400'));

    const outcome = await resolveGoogleCallback(
      { code: 'bad-code', state },
      { authDb: db, env: oauthEnv, redirectUri: REDIRECT_URI, exchange, logError },
    );
    expect(outcome).toEqual({ kind: 'redirect', location: `${FRONTEND}#error=google_failed` });
    expect(logError).toHaveBeenCalledTimes(1);
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it('redirects with #error=google_failed when there is no code and no error', async () => {
    const db = await freshAuthDb();
    const state = await issueOAuthState(env.JWT_SECRET, FRONTEND);
    const exchange = vi.fn();
    const outcome = await resolveGoogleCallback(
      { state },
      { authDb: db, env: oauthEnv, redirectUri: REDIRECT_URI, exchange, logError },
    );
    expect(outcome).toEqual({ kind: 'redirect', location: `${FRONTEND}#error=google_failed` });
    expect(exchange).not.toHaveBeenCalled();
  });

  it('redirects with #error=google_failed for an error other than access_denied', async () => {
    const db = await freshAuthDb();
    const state = await issueOAuthState(env.JWT_SECRET, FRONTEND);
    const exchange = vi.fn();
    const outcome = await resolveGoogleCallback(
      { state, error: 'server_error' },
      { authDb: db, env: oauthEnv, redirectUri: REDIRECT_URI, exchange, logError },
    );
    expect(outcome).toEqual({ kind: 'redirect', location: `${FRONTEND}#error=google_failed` });
    expect(exchange).not.toHaveBeenCalled();
  });

  it('redirects with #error=access_denied without calling exchange', async () => {
    const db = await freshAuthDb();
    const state = await issueOAuthState(env.JWT_SECRET, FRONTEND);
    const exchange = vi.fn();
    const outcome = await resolveGoogleCallback(
      { state, error: 'access_denied' },
      { authDb: db, env: oauthEnv, redirectUri: REDIRECT_URI, exchange, logError },
    );
    expect(outcome).toEqual({ kind: 'redirect', location: `${FRONTEND}#error=access_denied` });
    expect(exchange).not.toHaveBeenCalled();
  });
});

describe('DELETE /auth/me', () => {
  const AT = '2026-07-01T00:00:00.000Z';
  const stamps = (userId: string | null) => ({
    userId,
    createdAt: AT,
    updatedAt: AT,
  });
  const healthStamps = (userId: string | null) => ({
    ...stamps(userId),
    ignored: false,
    reason: '',
  });

  async function seedJob(id: string, userId: string | null) {
    await createJobApplication(createJobTrackerDb(env.JOB_TRACKER_DB), {
      id,
      company: 'Co',
      position: 'Engineer',
      ...stamps(userId),
    });
  }

  async function seedHealth(prefix: string, userId: string | null) {
    const db = createHealthMonitorDb(env.HEALTH_MONITOR_DB);
    await createGlucoseMeasurement(db, {
      id: `${prefix}-glucose`,
      measuredAt: AT,
      fastingValue: 90,
      ...healthStamps(userId),
    });
    await createSymptomEntry(db, {
      id: `${prefix}-symptom`,
      happenedAt: AT,
      type: 'HEADACHE',
      intensity: 3,
      ...healthStamps(userId),
    });
  }

  beforeEach(async () => {
    await freshJobTrackerDb();
    await freshHealthMonitorDb(
      glucoseMeasurements,
      bloodPressureMeasurements,
      weightMeasurements,
      symptomEntries,
    );
  });

  it('removes only the caller data and user row, then the old token is dead', async () => {
    const a = await seedUserAndGetToken({ username: 'alice' });
    const b = await seedUserAndGetToken({ username: 'bob' });
    await seedJob('job-a', a.userId);
    await seedJob('job-b', b.userId);
    await seedJob('job-demo', null);
    await seedHealth('a', a.userId);
    await seedHealth('demo', null);

    const res = await request('/auth/me', { method: 'DELETE', headers: bearer(a.token) });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');

    const jobDb = createJobTrackerDb(env.JOB_TRACKER_DB);
    const healthDb = createHealthMonitorDb(env.HEALTH_MONITOR_DB);
    const jobIds = async (ownerId: string | null) =>
      (await listJobApplications(jobDb, { page: 1, limit: 20, ownerId })).rows.map((j) => j.id);
    expect(await jobIds(a.userId)).toEqual([]);
    expect(await jobIds(b.userId)).toEqual(['job-b']);
    expect(await jobIds(null)).toEqual(['job-demo']);
    const range = { ownerId: a.userId };
    expect(await listGlucoseMeasurements(healthDb, range)).toHaveLength(0);
    expect(await listSymptomEntries(healthDb, range)).toHaveLength(0);
    expect(await listGlucoseMeasurements(healthDb, { ownerId: null })).toHaveLength(1);
    expect(await findUserById(createAuthDb(env.AUTH_DB), a.userId)).toBeUndefined();
    expect(await findUserById(createAuthDb(env.AUTH_DB), b.userId)).toBeDefined();

    const get = await request('/jobs', { headers: bearer(a.token) });
    expect(get.status).toBe(401);
    expect(((await get.json()) as ErrorEnvelope).error.message).toBe('Invalid or expired token');
    const post = await requestJson(
      'POST',
      '/jobs',
      { company: 'X', position: 'Y' },
      bearer(a.token),
    );
    expect(post.status).toBe(401);
    const again = await request('/auth/me', { method: 'DELETE', headers: bearer(a.token) });
    expect(again.status).toBe(401);
  });

  it('rejects a guest with 401 Authentication required', async () => {
    const res = await request('/auth/me', { method: 'DELETE' });
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrorEnvelope).error.message).toBe('Authentication required');
  });
});
