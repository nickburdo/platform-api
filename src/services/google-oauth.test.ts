import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exchangeGoogleCode } from './google-oauth.service';

const ENV = { GOOGLE_CLIENT_ID: 'client-id', GOOGLE_CLIENT_SECRET: 'client-secret' };
const REDIRECT_URI = 'https://example.com/auth/google/callback';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function idToken(claims: { iss?: string; aud?: string; sub?: string }): Promise<string> {
  return new SignJWT({ ...(claims.sub !== undefined ? { sub: claims.sub } : {}) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(claims.iss ?? 'https://accounts.google.com')
    .setAudience(claims.aud ?? ENV.GOOGLE_CLIENT_ID)
    .sign(new TextEncoder().encode('irrelevant-secret'));
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('exchangeGoogleCode', () => {
  it('returns the sub from the id_token and makes only the token call', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id_token: await idToken({ sub: 'sub-123' }), access_token: 'unused' }),
    );

    expect(await exchangeGoogleCode('auth-code', ENV, REDIRECT_URI)).toEqual({ sub: 'sub-123' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(tokenUrl).toBe('https://oauth2.googleapis.com/token');
    expect(tokenInit.method).toBe('POST');
    const body = tokenInit.body as URLSearchParams;
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('client_id')).toBe('client-id');
    expect(body.get('client_secret')).toBe('client-secret');
    expect(body.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(body.get('grant_type')).toBe('authorization_code');
  });

  it('accepts the bare accounts.google.com issuer', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id_token: await idToken({ iss: 'accounts.google.com', sub: 's' }) }),
    );
    expect(await exchangeGoogleCode('c', ENV, REDIRECT_URI)).toEqual({ sub: 's' });
  });

  it('throws when the token exchange itself fails (invalid/expired code)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'invalid_grant' }, 400));
    await expect(exchangeGoogleCode('bad-code', ENV, REDIRECT_URI)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when the response has no id_token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'token-123' }));
    await expect(exchangeGoogleCode('c', ENV, REDIRECT_URI)).rejects.toThrow('no id_token');
  });

  it('throws on a wrong audience', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id_token: await idToken({ aud: 'other-client', sub: 's' }) }),
    );
    await expect(exchangeGoogleCode('c', ENV, REDIRECT_URI)).rejects.toThrow('audience');
  });

  it('throws on a wrong issuer', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id_token: await idToken({ iss: 'https://evil.example.com', sub: 's' }) }),
    );
    await expect(exchangeGoogleCode('c', ENV, REDIRECT_URI)).rejects.toThrow('issuer');
  });

  it('throws on a missing or empty sub', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id_token: await idToken({}) }));
    await expect(exchangeGoogleCode('c', ENV, REDIRECT_URI)).rejects.toThrow('sub');
    fetchMock.mockResolvedValueOnce(jsonResponse({ id_token: await idToken({ sub: '' }) }));
    await expect(exchangeGoogleCode('c', ENV, REDIRECT_URI)).rejects.toThrow('sub');
  });

  it('throws on a malformed id_token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id_token: 'not-a-jwt' }));
    await expect(exchangeGoogleCode('c', ENV, REDIRECT_URI)).rejects.toThrow();
  });
});
