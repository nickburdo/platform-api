import { SignJWT, jwtVerify } from 'jose';

// CSRF protection for GET /auth/google's redirect (v3-plan.md Decision #8):
// a signed, storageless `state` — a short-lived JWT distinguished from a real
// access token by its `purpose` claim, not by a different signing key.

export const STATE_TTL = '10m';
const STATE_PURPOSE = 'oauth_state';

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

// `redirect` (the allow-listed frontend URL, validated before issuing) travels
// inside the signed state so the callback trusts only what this server signed
// itself (v4-plan.md Decision 13).
export async function issueOAuthState(secret: string, redirect: string): Promise<string> {
  return new SignJWT({
    purpose: STATE_PURPOSE,
    redirect,
    // Not verified by verifyOAuthState below — Decision #8's storageless
    // design has nothing to check it against (no server-side nonce
    // tracking), so it provides no replay protection by itself. CSRF
    // protection comes entirely from the signature + short expiry +
    // `purpose` claim. Kept only so two states issued within the same
    // second (same `iat`) aren't byte-identical tokens.
    nonce: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(STATE_TTL)
    .sign(secretKey(secret));
}

// Returns the claims of a valid, unexpired state issued by this server for
// this exact purpose, or null on any failure (bad signature, malformed,
// expired, wrong `purpose`, missing `redirect`) — the caller rejects before
// calling Google.
export async function verifyOAuthState(
  token: string,
  secret: string,
): Promise<{ redirect: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), { algorithms: ['HS256'] });
    if (payload.purpose !== STATE_PURPOSE || typeof payload.redirect !== 'string') {
      return null;
    }
    return { redirect: payload.redirect };
  } catch {
    return null;
  }
}
