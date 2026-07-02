import { describe, expect, it } from 'vitest';
import { request, requestJson } from './routes/test-helpers';

interface ErrorEnvelope {
  error: { message: string; details?: Record<string, unknown> };
}

describe('GET /health', () => {
  it('responds with the ok envelope and touches no database', async () => {
    const res = await request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { status: 'ok' } });
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
