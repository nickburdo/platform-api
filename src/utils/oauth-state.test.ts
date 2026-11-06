import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { issueOAuthState, verifyOAuthState } from './oauth-state';

const SECRET = 'oauth-state-test-secret';
const REDIRECT = 'https://job-tracker-new.pages.dev/auth/callback';

describe('issueOAuthState / verifyOAuthState', () => {
  it('round-trips a freshly issued state', async () => {
    const state = await issueOAuthState(SECRET, REDIRECT);
    expect(await verifyOAuthState(state, SECRET)).toEqual({ redirect: REDIRECT });
  });

  it('rejects a state signed with a different secret', async () => {
    const state = await issueOAuthState('other-secret', REDIRECT);
    expect(await verifyOAuthState(state, SECRET)).toBeNull();
  });

  it('rejects garbage and empty strings', async () => {
    expect(await verifyOAuthState('not.a.jwt', SECRET)).toBeNull();
    expect(await verifyOAuthState('', SECRET)).toBeNull();
  });

  it('rejects an expired state', async () => {
    const expired = await new SignJWT({ purpose: 'oauth_state', redirect: REDIRECT, nonce: 'x' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 700)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 100)
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyOAuthState(expired, SECRET)).toBeNull();
  });

  it('rejects a structurally valid token with the wrong purpose', async () => {
    const wrongPurpose = await new SignJWT({ purpose: 'access_token', redirect: REDIRECT, nonce: 'x' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyOAuthState(wrongPurpose, SECRET)).toBeNull();
  });

  it('rejects an access token (no purpose claim)', async () => {
    const accessToken = await new SignJWT({ sub: 'user-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyOAuthState(accessToken, SECRET)).toBeNull();
  });

  it('rejects a state without a redirect claim', async () => {
    const noRedirect = await new SignJWT({ purpose: 'oauth_state', nonce: 'x' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyOAuthState(noRedirect, SECRET)).toBeNull();
  });

  it('rejects a tampered payload (invalid signature)', async () => {
    const state = await issueOAuthState(SECRET, REDIRECT);
    const [header, , signature] = state.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({ purpose: 'oauth_state', redirect: 'https://evil.com/', nonce: 'tampered' }),
    ).toString('base64url');
    const tampered = `${header}.${tamperedPayload}.${signature}`;
    expect(await verifyOAuthState(tampered, SECRET)).toBeNull();
  });
});
