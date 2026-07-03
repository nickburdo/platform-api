import { SignJWT, jwtVerify } from 'jose';

// CSRF protection for GET /auth/google's redirect (v3-plan.md Decision #8):
// a signed, storageless `state` — a short-lived JWT distinguished from a real
// access token by its `purpose` claim, not by a different signing key.

export const STATE_TTL = '10m';
const STATE_PURPOSE = 'oauth_state';

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function issueOAuthState(secret: string): Promise<string> {
  return new SignJWT({ purpose: STATE_PURPOSE, nonce: crypto.randomUUID() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(STATE_TTL)
    .sign(secretKey(secret));
}

// Returns whether `token` is a valid, unexpired state issued by this server
// for this exact purpose. Any failure (bad signature, malformed, expired,
// wrong `purpose`) returns false — the caller rejects before calling Google.
export async function verifyOAuthState(token: string, secret: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret));
    return payload.purpose === STATE_PURPOSE;
  } catch {
    return false;
  }
}
