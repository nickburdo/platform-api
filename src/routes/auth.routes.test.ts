import { beforeEach, describe, expect, it } from 'vitest';
import { freshAuthDb } from '../db/auth/test-helpers';
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
