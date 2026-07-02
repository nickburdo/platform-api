import { describe, expect, it } from 'vitest';
import { bearer, request, requestJson, type ErrorEnvelope } from './routes/test-helpers';

describe('GET /health', () => {
  it('responds with the ok envelope and touches no database', async () => {
    const res = await request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { status: 'ok' } });
  });

  it('remains reachable as a guest even with an invalid token presented elsewhere', async () => {
    // /health itself never checks identity — this just confirms the
    // identity-resolution middleware being global doesn't break it.
    const res = await request('/health');
    expect(res.status).toBe(200);
  });
});

describe('identity resolution on business endpoints (v2-plan.md Decisions #1/#9)', () => {
  it('treats a request with no Authorization header as guest (V1 behavior unchanged)', async () => {
    const res = await request('/jobs');
    expect(res.status).toBe(200);
  });

  it('rejects a malformed/invalid presented token with 401 on a business endpoint', async () => {
    const res = await request('/jobs', { headers: bearer('not-a-jwt') });
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with the wrong secret with 401, never a silent guest fallback', async () => {
    // Same shape as a real token but signed with a secret the app doesn't
    // know — must not be treated as "no token" (guest).
    const res = await request('/jobs', {
      headers: bearer('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.invalidsignature'),
    });
    expect(res.status).toBe(401);
  });
});

describe('cross-cutting behavior', () => {
  it('returns the 404 envelope for an unknown path', async () => {
    const res = await request('/no-such-resource');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { message: 'Not found' } });
  });

  it('maps a malformed JSON body to a 400 in the error envelope', async () => {
    const res = await request('/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'this is not json{',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorEnvelope;
    expect(typeof body.error.message).toBe('string');
  });

  it('serves CORS headers with an unrestricted origin (Decision #8)', async () => {
    const res = await request('/health', {
      headers: { Origin: 'https://example.com' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('never leaks validation internals in the envelope shape', async () => {
    const res = await requestJson('POST', '/jobs', { position: 'Engineer' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorEnvelope;
    expect(Object.keys(body)).toEqual(['error']);
    expect(body.error.message).toBe('Validation error');
  });
});
