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

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('exchangeGoogleCode', () => {
  it('exchanges the code for a token, then the token for a verified email', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token-123' }))
      .mockResolvedValueOnce(jsonResponse({ email: 'admin@example.com', verified_email: true }));

    const result = await exchangeGoogleCode('auth-code', ENV, REDIRECT_URI);
    expect(result).toEqual({ email: 'admin@example.com' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(tokenUrl).toBe('https://oauth2.googleapis.com/token');
    expect(tokenInit.method).toBe('POST');
    const body = tokenInit.body as URLSearchParams;
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('client_id')).toBe('client-id');
    expect(body.get('client_secret')).toBe('client-secret');
    expect(body.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(body.get('grant_type')).toBe('authorization_code');

    const [userInfoUrl, userInfoInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(userInfoUrl).toBe('https://www.googleapis.com/oauth2/v2/userinfo');
    expect((userInfoInit.headers as Record<string, string>).Authorization).toBe(
      'Bearer token-123',
    );
  });

  it('throws when the token exchange itself fails (invalid/expired code)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'invalid_grant' }, 400));
    await expect(exchangeGoogleCode('bad-code', ENV, REDIRECT_URI)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when the userinfo call fails', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token-123' }))
      .mockResolvedValueOnce(jsonResponse({ error: 'invalid_token' }, 401));
    await expect(exchangeGoogleCode('auth-code', ENV, REDIRECT_URI)).rejects.toThrow();
  });

  it('throws when Google reports the email as unverified', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token-123' }))
      .mockResolvedValueOnce(jsonResponse({ email: 'admin@example.com', verified_email: false }));
    await expect(exchangeGoogleCode('auth-code', ENV, REDIRECT_URI)).rejects.toThrow();
  });
});
