import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { issueOAuthState, verifyOAuthState } from './oauth-state';

const SECRET = 'oauth-state-test-secret';

describe('issueOAuthState / verifyOAuthState', () => {
  it('round-trips a freshly issued state', async () => {
    const state = await issueOAuthState(SECRET);
    expect(await verifyOAuthState(state, SECRET)).toBe(true);
  });

  it('rejects a state signed with a different secret', async () => {
    const state = await issueOAuthState('other-secret');
    expect(await verifyOAuthState(state, SECRET)).toBe(false);
  });

  it('rejects garbage and empty strings', async () => {
    expect(await verifyOAuthState('not.a.jwt', SECRET)).toBe(false);
    expect(await verifyOAuthState('', SECRET)).toBe(false);
  });

  it('rejects an expired state', async () => {
    const expired = await new SignJWT({ purpose: 'oauth_state', nonce: 'x' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 700)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 100)
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyOAuthState(expired, SECRET)).toBe(false);
  });

  it('rejects a structurally valid token with the wrong purpose', async () => {
    const wrongPurpose = await new SignJWT({ purpose: 'access_token', nonce: 'x' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyOAuthState(wrongPurpose, SECRET)).toBe(false);
  });

  it('rejects a tampered payload (invalid signature)', async () => {
    const state = await issueOAuthState(SECRET);
    const [header, , signature] = state.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({ purpose: 'oauth_state', nonce: 'tampered' }),
    ).toString('base64url');
    const tampered = `${header}.${tamperedPayload}.${signature}`;
    expect(await verifyOAuthState(tampered, SECRET)).toBe(false);
  });
});
